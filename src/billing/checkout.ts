import { CheckoutAttempt, Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '../utils/prisma.js';
import { AppError } from '../utils/errors.js';
import { asaas, GatewayError } from './asaas.js';
import { billingConfig } from './config.js';
import { hash, statusToken } from './security.js';

export const CHECKOUT_MINUTES = 60;
export const OPEN_CHECKOUT_STATUSES = ['creating', 'pending', 'uncertain', 'paid'];

export const checkoutSchema = z
  .object({
    requestId: z.string().uuid(),
    planId: z.enum(['basico', 'pro', 'business']),
    nome: z.string().trim().min(2).max(120),
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((s) => s.toLowerCase()),
    empresaNome: z.string().trim().min(2).max(160),
  })
  .strict();
export async function lock(tx: Prisma.TransactionClient, key: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
}

type Reservation =
  | { checkout: CheckoutAttempt; fresh: boolean }
  | { blocking: CheckoutAttempt };

function reserve(
  input: z.infer<typeof checkoutSchema>,
  fingerprint: string,
  identity?: { userId: string; email: string },
) {
  return prisma.$transaction(async (tx): Promise<Reservation> => {
    await lock(tx, 'checkout-email:' + input.email);
    const existing = await tx.checkoutAttempt.findUnique({
      where: { requestId: input.requestId },
    });
    if (existing) {
      if (existing.fingerprint !== fingerprint)
        throw new AppError('Tentativa já utilizada com outros dados.', 409);
      return { checkout: existing, fresh: false };
    }
    const plan = await tx.billingPlan.findUnique({
      where: { id: input.planId },
    });
    if (!plan?.available || plan.priceCents <= 0 || plan.cycle !== 'MONTHLY')
      throw new AppError('Plano indisponível.', 422);
    const user = await tx.user.findFirst({
      where: { email: { equals: input.email, mode: 'insensitive' } },
    });
    if (user && (identity?.userId !== user.id || !user.ativo)) {
      throw new AppError(
        'Para continuar com este email, entre na sua conta ou contate o suporte.',
        409,
        'SIGN_IN_REQUIRED',
      );
    }
    if (
      user &&
      (await tx.subscription.findFirst({
        where: { empresa: { ownerId: user.id }, canceledAt: null },
      }))
    ) {
      throw new AppError('Gerencie sua assinatura atual no painel.', 409);
    }
    const blocking = await tx.checkoutAttempt.findFirst({
      where: { email: input.email, status: { in: OPEN_CHECKOUT_STATUSES } },
    });
    if (blocking) return { blocking };
    const checkout = await tx.checkoutAttempt.create({
      data: {
        requestId: input.requestId,
        fingerprint,
        planId: plan.id,
        priceCents: plan.priceCents,
        nome: input.nome,
        email: input.email,
        empresaNome: input.empresaNome,
        existingUserId: user?.id,
        expiresAt: new Date(Date.now() + CHECKOUT_MINUTES * 60000),
      },
    });
    return { checkout, fresh: true };
  });
}

// A visitor who abandoned a checkout (other device, other plan) may start over.
// The previous Asaas checkout is cancelled first, so it can no longer be paid.
async function release(open: CheckoutAttempt) {
  if (open.status === 'paid')
    throw new AppError(
      'Já recebemos um pagamento para este email. Confira sua caixa de entrada.',
      409,
    );
  if (!open.gatewayId) {
    // Without a gateway ID the link never reached the visitor, so nobody can pay
    // it. Only a creation still in flight (gateway timeout is 10s) must wait.
    if (open.status === 'creating' && open.createdAt.getTime() > Date.now() - 120000)
      throw new AppError(
        'Uma tentativa anterior ainda está sendo preparada. Aguarde alguns instantes.',
        409,
      );
  } else {
    try {
      await asaas.cancelCheckout(open.gatewayId);
    } catch (error) {
      // 400 means the checkout is no longer active (paid, expired or cancelled).
      if (
        !(error instanceof GatewayError && [400, 404].includes(error.gatewayStatus))
      )
        throw error;
      const paid = await asaas.payments('checkoutSession', open.gatewayId);
      if (paid.length) {
        await prisma.checkoutAttempt.update({
          where: { id: open.id },
          data: { nextReconcileAt: new Date() },
        });
        throw new AppError(
          'Já recebemos um pagamento para este email. Confira sua caixa de entrada.',
          409,
        );
      }
    }
  }
  await prisma.$transaction(async (tx) => {
    await lock(tx, 'billing-checkout:' + open.id);
    await tx.checkoutAttempt.updateMany({
      where: { id: open.id, status: open.status, subscription: { is: null } },
      // One last reconciliation catches a payment that was still settling.
      data: {
        status: open.gatewayId ? 'canceled' : 'expired',
        nextReconcileAt: new Date(Date.now() + 10 * 60000),
      },
    });
    await tx.billingAudit.create({
      data: { action: 'checkout.replaced', resourceId: open.id },
    });
  });
}

export async function createCheckout(
  input: z.infer<typeof checkoutSchema>,
  identity?: { userId: string; email: string },
) {
  const config = billingConfig();
  const fingerprint = hash(JSON.stringify(input));
  let reserved = await reserve(input, fingerprint, identity);
  if ('blocking' in reserved) {
    await release(reserved.blocking);
    reserved = await reserve(input, fingerprint, identity);
    if ('blocking' in reserved)
      throw new AppError('Já existe uma tentativa em andamento.', 409);
  }
  let checkout = reserved.checkout;
  if (reserved.fresh) {
    const callback = `${config.appUrl}/checkout/retorno#id=${checkout.id}&token=${statusToken(checkout.id)}`;
    const plan = await prisma.billingPlan.findUniqueOrThrow({
      where: { id: checkout.planId },
    });
    try {
      const remote = await asaas.createCheckout({
        billingTypes: ['CREDIT_CARD'],
        chargeTypes: ['RECURRENT'],
        minutesToExpire: CHECKOUT_MINUTES,
        externalReference: checkout.id,
        callback: {
          successUrl: callback,
          cancelUrl: callback,
          expiredUrl: callback,
        },
        items: [
          {
            name: `Zentra ${plan.name}`,
            description: `Assinatura mensal do plano ${plan.name}`,
            quantity: 1,
            value: checkout.priceCents / 100,
          },
        ],
        // Card, taxpayer ID and address are collected exclusively by Asaas.
        subscription: {
          cycle: 'MONTHLY',
          nextDueDate: new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Sao_Paulo',
          }).format(new Date()),
        },
      });
      checkout = await prisma.checkoutAttempt.update({
        where: { id: checkout.id },
        data: {
          gatewayId: remote.id,
          gatewayUrl: remote.link,
          status: 'pending',
          nextReconcileAt: new Date(Date.now() + 2 * 60000),
        },
      });
    } catch {
      await prisma.checkoutAttempt.update({
        where: { id: checkout.id },
        data: { status: 'uncertain', lastError: 'CHECKOUT_CREATION_UNCERTAIN' },
      });
      throw new AppError(
        'Não foi possível abrir o pagamento agora. Tente novamente em instantes; nenhuma cobrança foi feita.',
        502,
        'CHECKOUT_UNCERTAIN',
      );
    }
  }
  if (
    !checkout.gatewayUrl ||
    checkout.status !== 'pending' ||
    checkout.expiresAt < new Date()
  ) {
    throw new AppError(
      'Esta tentativa aguarda conciliação ou já foi encerrada.',
      409,
    );
  }
  return {
    id: checkout.id,
    statusToken: statusToken(checkout.id),
    url: checkout.gatewayUrl,
  };
}
