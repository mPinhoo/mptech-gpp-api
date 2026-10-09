import { z } from 'zod';
import prisma from '../utils/prisma.js';
import { asaas, GatewayError } from './asaas.js';
import { reconcileCheckout } from './reconcile.js';
import { AppError } from '../utils/errors.js';
import { enqueueMail } from './outbox.js';
import { lock } from './checkout.js';
import { secureEqual } from './security.js';
import { PAID_STATUSES } from './state.js';

const resource = z.object({ id: z.string().min(1).max(200) });
const eventSchema = z.object({
  id: z.string().min(1).max(200),
  event: z.string().max(100),
  payment: resource.optional(),
  subscription: resource.optional(),
  checkout: resource.optional(),
});
export const WEBHOOK_EVENTS = [
  'CHECKOUT_CREATED',
  'CHECKOUT_PAID',
  'CHECKOUT_CANCELED',
  'CHECKOUT_EXPIRED',
  'SUBSCRIPTION_CREATED',
  'SUBSCRIPTION_UPDATED',
  'SUBSCRIPTION_INACTIVATED',
  'SUBSCRIPTION_DELETED',
  'PAYMENT_CREATED',
  'PAYMENT_UPDATED',
  'PAYMENT_CONFIRMED',
  'PAYMENT_RECEIVED',
  'PAYMENT_OVERDUE',
  'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED',
  'PAYMENT_REPROVED_BY_RISK_ANALYSIS',
  'PAYMENT_REFUNDED',
  'PAYMENT_PARTIALLY_REFUNDED',
  'PAYMENT_REFUND_IN_PROGRESS',
  'PAYMENT_DELETED',
  'PAYMENT_RESTORED',
  'PAYMENT_REFUND_DENIED',
  'PAYMENT_RECEIVED_IN_CASH_UNDONE',
  'PAYMENT_CHARGEBACK_REQUESTED',
  'PAYMENT_CHARGEBACK_DISPUTE',
  'PAYMENT_AWAITING_CHARGEBACK_REVERSAL',
];
export async function receiveWebhook(token: string | undefined, body: unknown) {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN;
  if (
    !expected ||
    expected.length < 32 ||
    !token ||
    !secureEqual(expected, token)
  )
    throw new AppError('Webhook não autorizado.', 401);
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) {
    // Answer 200 anyway: Asaas pauses the whole queue after repeated failures,
    // and periodic reconciliation still covers whatever this event announced.
    await prisma.billingAudit.create({
      data: { action: 'webhook.unrecognized', resourceId: 'asaas' },
    });
    return;
  }
  const e = parsed.data;
  if (!WEBHOOK_EVENTS.includes(e.event)) return;
  const type = e.event.startsWith('PAYMENT_')
    ? 'payment'
    : e.event.startsWith('SUBSCRIPTION_')
      ? 'subscription'
      : 'checkout';
  const item = e[type];
  if (!item) {
    await prisma.billingAudit.create({
      data: { action: 'webhook.unrecognized', resourceId: e.id },
    });
    return;
  }
  // ON CONFLICT DO NOTHING: concurrent duplicate deliveries must both succeed.
  // An explicit millisecond timestamp avoids TIMESTAMP(3) rounding a DB default
  // into the future, which would hide the row from an immediate processing run.
  const now = new Date();
  await prisma.billingWebhook.createMany({
    data: [
      {
        id: e.id,
        event: e.event,
        resourceType: type,
        resourceId: item.id,
        availableAt: now,
        receivedAt: now,
      },
    ],
    skipDuplicates: true,
  });
}

// Subscription events may precede CHECKOUT_PAID: resolve them through the
// checkout session read from the gateway, never from the event body.
async function checkoutForSubscription(subscriptionId: string) {
  const linked = await prisma.checkoutAttempt.findUnique({
    where: { gatewaySubscriptionId: subscriptionId },
  });
  if (linked) return linked;
  const remote = await asaas.subscription(subscriptionId).catch((error: unknown) => {
    if (error instanceof GatewayError && error.gatewayStatus === 404) return null;
    throw error;
  });
  return remote?.checkoutSession
    ? prisma.checkoutAttempt.findUnique({ where: { gatewayId: remote.checkoutSession } })
    : null;
}
export async function processWebhooks() {
  const rows = await prisma.billingWebhook.findMany({
    where: {
      status: { in: ['pending', 'processing'] },
      availableAt: { lte: new Date() },
    },
    take: 20,
    orderBy: { receivedAt: 'asc' },
  });
  for (const row of rows) {
    const claim = await prisma.billingWebhook.updateMany({
      where: { id: row.id, status: row.status, availableAt: row.availableAt },
      data: {
        status: 'processing',
        availableAt: new Date(Date.now() + 120000),
        attempts: { increment: 1 },
      },
    });
    if (!claim.count) continue;
    try {
      let checkout;
      if (row.resourceType === 'checkout')
        checkout = await prisma.checkoutAttempt.findUnique({
          where: { gatewayId: row.resourceId },
        });
      if (row.resourceType === 'subscription')
        checkout = await checkoutForSubscription(row.resourceId);
      if (row.resourceType === 'payment') {
        let payment;
        try {
          payment = await asaas.payment(row.resourceId);
        } catch (error) {
          if (!(error instanceof GatewayError && error.gatewayStatus === 404))
            throw error;
          const stored = await prisma.billingPayment.findUnique({
            where: { id: row.resourceId },
            include: { subscription: { include: { checkout: true } } },
          });
          checkout = stored?.subscription.checkout;
        }
        if (payment) {
          checkout = payment.checkoutSession
            ? await prisma.checkoutAttempt.findUnique({
                where: { gatewayId: payment.checkoutSession },
              })
            : null;
          if (!checkout && payment.subscription)
            checkout = await checkoutForSubscription(payment.subscription);
        }
      }
      // Checkout links are stored before they reach the visitor, so a resource
      // that resolves to no checkout is not a Zentra sale (shared Asaas account,
      // CHECKOUT_CREATED racing the insert). Reconciliation covers the rest.
      if (!checkout) {
        await prisma.billingWebhook.update({
          where: { id: row.id },
          data: { status: 'ignored', processedAt: new Date(), lastError: null },
        });
        continue;
      }
      await reconcileCheckout(checkout.id);
      if (['CHECKOUT_CANCELED', 'CHECKOUT_EXPIRED'].includes(row.event)) {
        await prisma.$transaction(async (tx) => {
          await lock(tx, 'billing-checkout:' + checkout!.id);
          await tx.checkoutAttempt.updateMany({
            where: {
              id: checkout!.id,
              subscription: { is: null },
              gatewaySubscriptionId: null,
            },
            data: {
              status:
                row.event === 'CHECKOUT_CANCELED' ? 'canceled' : 'expired',
            },
          });
        });
      }
      if (
        [
          'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED',
          'PAYMENT_REPROVED_BY_RISK_ANALYSIS',
        ].includes(row.event)
      ) {
        const current = await asaas.payment(row.resourceId);
        if (!PAID_STATUSES.includes(current.status)) {
          const subscribed = await prisma.subscription.count({
            where: { checkoutId: checkout.id },
          });
          const plan = await prisma.billingPlan.findUniqueOrThrow({
            where: { id: checkout.planId },
          });
          await prisma.$transaction((tx) =>
            enqueueMail(
              tx,
              'declined:' + row.resourceId,
              checkout!.email,
              'declined',
              {
                nome: checkout!.nome,
                planName: plan.name,
                actionPath: subscribed
                  ? '/assinatura'
                  : `/comecar?plano=${plan.id}`,
              },
            ),
          );
        }
      }
      await prisma.billingWebhook.update({
        where: { id: row.id },
        data: { status: 'processed', processedAt: new Date(), lastError: null },
      });
    } catch (error) {
      await prisma.billingWebhook.update({
        where: { id: row.id },
        data: {
          status: row.attempts >= 19 ? 'failed' : 'pending',
          lastError:
            error instanceof AppError ? error.code : 'PROCESSING_FAILED',
          availableAt: new Date(
            Date.now() + Math.min(3600000, 10000 * 2 ** row.attempts),
          ),
        },
      });
    }
  }
}
