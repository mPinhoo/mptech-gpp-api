import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma.js';
import { AppError } from '../utils/errors.js';
import { initializeNewUser } from '../services/user-setup.service.js';
import { ensureDefaultUserGroup } from '../services/permissions.service.js';
import { asaas, GatewayError, GatewaySubscription } from './asaas.js';
import { lock } from './checkout.js';
import { deriveState, PAID_STATUSES, SubscriptionEnd } from './state.js';
import { graceDays } from './config.js';
import { createInvite, enqueueMail, MailKind } from './outbox.js';

const MINUTE = 60000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const mismatch = () =>
  new AppError('Cobrança requer revisão financeira.', 422, 'BILLING_MISMATCH');

// Periodic safety net for missed webhooks; webhooks remain the primary trigger.
export function nextCheck(status: string, paidUntil: Date | null, now = Date.now()) {
  if (['canceled', 'expired'].includes(status))
    return paidUntil && paidUntil.getTime() > now - 7 * DAY
      ? new Date(now + DAY)
      : null;
  if (status === 'suspended') return new Date(now + DAY);
  const renewal = paidUntil
    ? Math.max(now + 15 * MINUTE, paidUntil.getTime() + HOUR)
    : now + 15 * MINUTE;
  return new Date(Math.min(now + 6 * HOUR, renewal));
}

// Current gateway data is fetched under a per-checkout transaction lock. Event
// timestamps are not used as financial truth, so late/duplicate events are safe.
export async function reconcileCheckout(id: string) {
  return prisma
    .$transaction(
      async (tx) => {
        await lock(tx, 'billing-checkout:' + id);
        const checkout = await tx.checkoutAttempt.findUnique({
          where: { id },
          include: { plan: true, subscription: true },
        });
        if (!checkout) return;
        const now = Date.now();
        if (!checkout.gatewayId) {
          // The hosted link never reached the visitor; close it once it would
          // expire. The guard keeps a creation that just succeeded untouched.
          const expired = checkout.expiresAt.getTime() < now;
          await tx.checkoutAttempt.updateMany({
            where: { id, gatewayId: null },
            data: expired
              ? { status: 'expired', nextReconcileAt: null }
              : { nextReconcileAt: checkout.expiresAt },
          });
          return;
        }
        let payments = await asaas.payments(
          checkout.gatewaySubscriptionId ? 'subscription' : 'checkoutSession',
          checkout.gatewaySubscriptionId || checkout.gatewayId,
        );
        if (!payments.length && !checkout.gatewaySubscriptionId) {
          // A cancelled checkout cannot be paid anymore; an open one may still be
          // settling a few minutes after its expiry.
          const settled =
            checkout.status !== 'pending' ||
            checkout.expiresAt.getTime() + 10 * MINUTE < now;
          await tx.checkoutAttempt.update({
            where: { id },
            data: {
              status:
                settled && checkout.status === 'pending' ? 'expired' : checkout.status,
              nextReconcileAt: settled ? null : new Date(now + 2 * MINUTE),
              lastError: null,
            },
          });
          return;
        }
        const subId =
          checkout.gatewaySubscriptionId || payments[0]?.subscription;
        if (!subId) throw mismatch();
        // The first association must come from a server-side query filtered by the
        // checkout ID. Never trust subscription/customer identifiers in a webhook.
        if (payments.some((p) => p.subscription !== subId)) throw mismatch();
        let remote: GatewaySubscription;
        try {
          remote = await asaas.subscription(subId);
        } catch (error) {
          if (!(
            error instanceof GatewayError &&
            error.gatewayStatus === 404 &&
            checkout.subscription
          ))
            throw error;
          remote = {
            id: subId,
            customer: checkout.subscription.customerId,
            value: checkout.priceCents / 100,
            cycle: 'MONTHLY',
            billingType: 'CREDIT_CARD',
            status: 'INACTIVE',
            deleted: true,
            nextDueDate:
              checkout.subscription.nextDueDate?.toISOString().slice(0, 10) ||
              new Date().toISOString().slice(0, 10),
          };
        }
        if (
          remote.id !== subId ||
          (remote.checkoutSession && remote.checkoutSession !== checkout.gatewayId) ||
          remote.cycle !== 'MONTHLY' ||
          remote.billingType !== 'CREDIT_CARD' ||
          Math.round(remote.value * 100) !== checkout.priceCents
        )
          throw mismatch();
        if (
          checkout.gatewayCustomerId &&
          checkout.gatewayCustomerId !== remote.customer
        )
          throw mismatch();
        if (!checkout.gatewayCustomerId) {
          const customer = await asaas.customer(remote.customer);
          if (customer.id !== remote.customer) throw mismatch();
          // The payer types their email again on the hosted page. The account is
          // always bound to the email given to Zentra; a difference is only audited.
          if (customer.email?.trim().toLowerCase() !== checkout.email)
            await tx.billingAudit.create({
              data: { action: 'checkout.payer_email_differs', resourceId: id },
            });
          payments = await asaas.payments('subscription', subId);
        }
        if (
          payments.some(
            (p) =>
              p.subscription !== subId ||
              p.customer !== remote.customer ||
              p.billingType !== 'CREDIT_CARD' ||
              Math.round(p.value * 100) !== checkout.priceCents,
          )
        )
          throw mismatch();
        const ended: SubscriptionEnd =
          checkout.subscription?.canceledAt ||
          remote.deleted ||
          remote.status === 'INACTIVE'
            ? 'canceled'
            : remote.status === 'EXPIRED'
              ? 'expired'
              : null;
        const state = deriveState(payments, ended, graceDays());
        if (!checkout.subscription && !state.paidUntil) {
          // Subscription exists but nothing was paid yet (e.g. card declined).
          // Webhooks keep it reachable after the polling window closes.
          await tx.checkoutAttempt.update({
            where: { id },
            data: {
              gatewaySubscriptionId: subId,
              gatewayCustomerId: remote.customer,
              lastError: null,
              nextReconcileAt:
                checkout.expiresAt.getTime() + DAY < now
                  ? null
                  : new Date(now + 15 * MINUTE),
            },
          });
          return;
        }

        await lock(tx, 'checkout-email:' + checkout.email);
        let user = await tx.user.findFirst({
          where: { email: { equals: checkout.email, mode: 'insensitive' } },
        });
        let created = false;
        if (!user) {
          // Random non-delivered password; activation is the only first-access path.
          const group = await ensureDefaultUserGroup(tx);
          user = await tx.user.create({
            data: {
              nome: checkout.nome,
              email: checkout.email,
              senha: await bcrypt.hash(randomBytes(48).toString('hex'), 12),
              ativo: false,
              billingManaged: true,
              grupoPermissaoId: group.id,
            },
          });
          await initializeNewUser(user.id, tx);
          created = true;
        } else if (
          !checkout.subscription &&
          user.id !== checkout.existingUserId
        ) {
          // Account was created while checkout was open. Never attach by email alone.
          throw mismatch();
        }
        const empresa = await tx.empresa.upsert({
          where: { ownerId: user.id },
          update: {},
          create: { ownerId: user.id, nome: checkout.empresaNome },
        });
        const duplicate = await tx.subscription.findFirst({
          where: {
            empresaId: empresa.id,
            checkoutId: { not: id },
            canceledAt: null,
          },
        });
        if (duplicate) throw mismatch();
        const nextDueDate = new Date(
          remote.nextDueDate.slice(0, 10) + 'T00:00:00-03:00',
        );
        if (!Number.isFinite(nextDueDate.getTime())) throw mismatch();
        const subscription = await tx.subscription.upsert({
          where: { checkoutId: id },
          create: {
            empresaId: empresa.id,
            planId: checkout.planId,
            checkoutId: id,
            gatewayId: subId,
            customerId: remote.customer,
            priceCents: checkout.priceCents,
            ...state,
            nextDueDate,
            canceledAt: ended ? new Date() : null,
          },
          update: {
            ...state,
            nextDueDate,
            ...(ended
              ? { canceledAt: checkout.subscription?.canceledAt || new Date() }
              : {}),
          },
        });
        await tx.user.update({
          where: { id: user.id },
          data: { billingManaged: true },
        });
        const firstPayment = [...payments].sort((a, b) =>
          a.dueDate.localeCompare(b.dueDate),
        )[0];
        for (const payment of payments) {
          const paidAt = payment.paymentDate || payment.confirmedDate;
          const invoiceUrl = payment.invoiceUrl?.startsWith('https://')
            ? payment.invoiceUrl
            : null;
          await tx.billingPayment.upsert({
            where: { id: payment.id },
            create: {
              id: payment.id,
              subscriptionId: subscription.id,
              valueCents: Math.round(payment.value * 100),
              status: payment.status,
              dueDate: new Date(payment.dueDate + 'T00:00:00-03:00'),
              paidAt: paidAt ? new Date(paidAt) : null,
              invoiceUrl,
            },
            update: {
              status: payment.status,
              paidAt: paidAt ? new Date(paidAt) : null,
              invoiceUrl,
            },
          });
          if (PAID_STATUSES.includes(payment.status)) {
            const first = payment.id === firstPayment?.id;
            // A new account gets one message: the activation email already
            // confirms the first payment.
            await enqueueMail(
              tx,
              `payment:${payment.id}`,
              user.email,
              first ? 'payment' : 'renewal',
              { nome: user.nome, planName: checkout.plan.name },
              { suppress: created && first },
            );
          }
        }
        if (created) await createInvite(tx, user, checkout.plan.name, 'activation');
        if (checkout.subscription?.status !== state.status) {
          await tx.billingAudit.create({
            data: {
              action: 'subscription.' + state.status,
              resourceId: subscription.id,
            },
          });
          if (['past_due', 'suspended', 'canceled'].includes(state.status)) {
            await enqueueMail(
              tx,
              `state:${subscription.id}:${state.status}:${state.paidUntil?.toISOString() || 'none'}`,
              user.email,
              state.status as MailKind,
              {
                nome: user.nome,
                planName: checkout.plan.name,
                paidUntil: state.paidUntil?.toISOString(),
              },
            );
          }
        }
        await tx.checkoutAttempt.update({
          where: { id },
          data: {
            status: ended ? 'canceled' : 'paid',
            gatewaySubscriptionId: subId,
            gatewayCustomerId: remote.customer,
            lastError: null,
            nextReconcileAt: nextCheck(state.status, state.paidUntil, now),
          },
        });
        return subscription;
      },
      { timeout: 90000, maxWait: 10000 },
    )
    .catch(async (error: unknown) => {
      if (error instanceof AppError && error.code === 'BILLING_MISMATCH') {
        await prisma.$transaction(async (tx) => {
          await lock(tx, 'billing-checkout:' + id);
          await tx.subscription.updateMany({
            where: { checkoutId: id, canceledAt: null },
            data: { status: 'suspended' },
          });
          await tx.checkoutAttempt.update({
            where: { id },
            data: {
              lastError: 'BILLING_MISMATCH',
              nextReconcileAt: new Date(Date.now() + 6 * HOUR),
            },
          });
          await tx.billingAudit.create({
            data: { action: 'financial.review_required', resourceId: id },
          });
        });
      }
      throw error;
    });
}
