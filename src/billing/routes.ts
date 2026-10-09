import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '../utils/prisma.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { signToken, verifyToken } from '../utils/jwt.js';
import { AppError } from '../utils/errors.js';
import { billingConfig, billingEnvironment, graceDays } from './config.js';
import { hasAccess } from './state.js';
import { planUsage } from './access.js';
import { runBillingWorker } from './worker.js';
import { createCheckout, checkoutSchema, lock } from './checkout.js';
import { hash, secureEqual, statusToken } from './security.js';
import { receiveWebhook } from './webhooks.js';
import { createInvite, enqueueMail } from './outbox.js';
import { asaas } from './asaas.js';

const router = Router();
// Single-process rate limit: shared gateway limits are additionally enforced by
// persisted checkout reservations. Configure edge rate limits for multi-instance deployments.
export function rateLimit(max: number, windowMs: number) {
  const buckets = new Map<string, { count: number; until: number }>();
  return (req: Request, _res: Response, next: NextFunction) => {
    const now = Date.now();
    for (const [key, bucket] of buckets)
      if (bucket.until < now) buckets.delete(key);
    const key = req.ip || 'unknown';
    const bucket = buckets.get(key) || { count: 0, until: now + windowMs };
    if (++bucket.count > max || buckets.size > 10000)
      return next(
        new AppError('Muitas tentativas. Aguarde alguns minutos.', 429),
      );
    buckets.set(key, bucket);
    next();
  };
}
router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
router.post('/webhooks/asaas', async (req, res, next) => {
  try {
    await receiveWebhook(req.get('asaas-access-token'), req.body);
    res.json({ received: true });
    // Process right away instead of waiting for the next worker tick.
    setImmediate(() => void runBillingWorker().catch(() => undefined));
  } catch (e) {
    next(e);
  }
});
router.get('/plans', async (_req, res) => {
  const plans = await prisma.billingPlan.findMany({
    where: { available: true },
    orderBy: { priceCents: 'asc' },
    select: {
      id: true,
      name: true,
      description: true,
      priceCents: true,
      cycle: true,
      features: true,
      limits: true,
    },
  });
  let enabled = true;
  try {
    billingConfig();
  } catch {
    enabled = false;
  }
  res.json({ data: plans, enabled, environment: billingEnvironment() });
});
router.post('/checkouts', rateLimit(10, 600000), async (req, res, next) => {
  try {
    const input = checkoutSchema.parse(req.body);
    let identity;
    if (req.headers.authorization?.startsWith('Bearer ')) {
      try {
        identity = verifyToken(req.headers.authorization.slice(7));
      } catch {
        // A stale session left in the browser must not block a purchase; an
        // existing account still gets SIGN_IN_REQUIRED for its email.
        identity = undefined;
      }
      if (identity?.impersonatedBy)
        throw new AppError('Saia do modo de impersonação para contratar.', 403);
    }
    res.status(201).json({ data: await createCheckout(input, identity) });
  } catch (e) {
    next(e);
  }
});
router.post(
  '/checkout-status',
  rateLimit(120, 60000),
  async (req, res, next) => {
    try {
      const { id, token } = z
        .object({ id: z.string().uuid(), token: z.string().length(64) })
        .parse(req.body);
      if (!secureEqual(token, statusToken(id)))
        throw new AppError('Tentativa não encontrada.', 404);
      const checkout = await prisma.checkoutAttempt.findUnique({
        where: { id },
        select: {
          status: true,
          expiresAt: true,
          lastError: true,
          subscription: { select: { status: true } },
        },
      });
      if (!checkout) throw new AppError('Tentativa não encontrada.', 404);
      res.json({
        data: {
          status: checkout.status,
          subscriptionStatus: checkout.subscription?.status || null,
          // Only a financial divergence needs a human; transient errors retry.
          requiresReview: checkout.lastError === 'BILLING_MISMATCH',
        },
      });
    } catch (e) {
      next(e);
    }
  },
);
router.post('/activate', rateLimit(10, 600000), async (req, res, next) => {
  try {
    const { token, senha } = z
      .object({
        token: z.string().regex(/^[a-f0-9]{64}$/),
        senha: z.string().min(12).max(128),
      })
      .strict()
      .parse(req.body);
    const password = await bcrypt.hash(senha, 12);
    const activated = await prisma.$transaction(async (tx) => {
      const invite = await tx.activationInvite.findUnique({
        where: { tokenHash: hash(token) },
      });
      if (!invite) throw new AppError('Convite inválido ou expirado.', 422);
      await lock(tx, 'activation:' + invite.userId);
      const used = await tx.activationInvite.updateMany({
        where: { id: invite.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (!used.count) throw new AppError('Convite inválido ou expirado.', 422);
      const user = await tx.user.findUnique({ where: { id: invite.userId } });
      if (!user || user.ativo)
        throw new AppError('Convite inválido ou expirado.', 422);
      await tx.user.update({
        where: { id: user.id },
        data: { senha: password, ativo: true },
      });
      await tx.billingAudit.create({
        data: { action: 'account.activated', resourceId: user.id },
      });
      return user;
    });
    // Proving possession of the single-use invite is equivalent to a login.
    res.json({
      success: true,
      token: signToken({ userId: activated.id, email: activated.email }),
    });
  } catch (e) {
    next(e);
  }
});
router.post(
  '/resend-activation',
  rateLimit(3, 3600000),
  async (req, res, next) => {
    try {
      const { email } = z
        .object({
          email: z
            .string()
            .email()
            .transform((s) => s.toLowerCase()),
        })
        .parse(req.body);
      await prisma.$transaction(async (tx) => {
        const user = await tx.user.findFirst({
          where: {
            email: { equals: email, mode: 'insensitive' },
            ativo: false,
            billingManaged: true,
          },
        });
        if (!user) return;
        await lock(tx, 'activation:' + user.id);
        const recent = await tx.activationInvite.findFirst({
          where: {
            userId: user.id,
            createdAt: { gt: new Date(Date.now() - 600000) },
          },
        });
        if (recent) return;
        const sub = await tx.subscription.findFirst({
          where: { empresa: { ownerId: user.id } },
          orderBy: { createdAt: 'desc' },
          include: { plan: true },
        });
        if (sub && hasAccess(sub, graceDays()))
          await createInvite(tx, user, sub.plan.name, 'resend');
      });
      res.json({
        message:
          'Se houver uma ativação pendente, você receberá um novo convite.',
      });
    } catch (e) {
      next(e);
    }
  },
);
router.get('/subscription', authMiddleware, async (req, res, next) => {
  try {
    const sub = await prisma.subscription.findFirst({
      where: { empresa: { ownerId: req.user!.userId } },
      orderBy: { createdAt: 'desc' },
      include: {
        plan: true,
        payments: { orderBy: { dueDate: 'desc' }, take: 36 },
      },
    });
    res.json({
      data: sub
        ? {
            id: sub.id,
            status: sub.status,
            hasAccess: hasAccess(sub, graceDays()),
            graceDays: graceDays(),
            plan: {
              id: sub.plan.id,
              name: sub.plan.name,
              description: sub.plan.description,
              priceCents: sub.priceCents,
              cycle: sub.plan.cycle,
              features: sub.plan.features,
              limits: sub.plan.limits,
            },
            usage: await planUsage(req.user!.userId),
            startedAt: sub.startedAt,
            paidUntil: sub.paidUntil,
            nextDueDate: sub.nextDueDate,
            canceledAt: sub.canceledAt,
            cancelRequested: !!sub.cancelRequestedAt,
            payments: sub.payments.map((p) => ({
              id: p.id,
              valueCents: p.valueCents,
              status: p.status,
              dueDate: p.dueDate,
              paidAt: p.paidAt,
              // Only open charges need the hosted invoice.
              invoiceUrl: ['PENDING', 'OVERDUE'].includes(p.status)
                ? p.invoiceUrl
                : null,
            })),
          }
        : null,
    });
  } catch (e) {
    next(e);
  }
});
router.post(
  '/subscription/cancel',
  authMiddleware,
  rateLimit(5, 600000),
  async (req, res, next) => {
    try {
      if (req.user!.impersonatedBy)
        throw new AppError('Saia do modo de impersonação para cancelar.', 403);
      const sub = await prisma.subscription.findFirst({
        where: { empresa: { ownerId: req.user!.userId } },
        orderBy: { createdAt: 'desc' },
      });
      if (!sub) throw new AppError('Assinatura não encontrada.', 404);
      if (sub.canceledAt) {
        res.json({ success: true });
        return;
      }
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { cancelRequestedAt: sub.cancelRequestedAt || new Date() },
      });
      await asaas.cancelSubscription(sub.gatewayId);
      await prisma.$transaction(async (tx) => {
        await lock(tx, 'billing-checkout:' + sub.checkoutId);
        await tx.subscription.update({
          where: { id: sub.id },
          data: { status: 'canceled', canceledAt: new Date() },
        });
        await tx.checkoutAttempt.update({
          where: { id: sub.checkoutId },
          data: { nextReconcileAt: new Date() },
        });
        await tx.billingAudit.create({
          data: { action: 'subscription.cancel_requested', resourceId: sub.id },
        });
        const user = await tx.user.findUniqueOrThrow({
          where: { id: req.user!.userId },
        });
        const plan = await tx.billingPlan.findUniqueOrThrow({
          where: { id: sub.planId },
        });
        await enqueueMail(tx, 'cancel:' + sub.id, user.email, 'canceled', {
          nome: user.nome,
          planName: plan.name,
          paidUntil: sub.paidUntil?.toISOString(),
        });
      });
      res.json({ success: true });
    } catch (e) {
      next(e);
    }
  },
);
export default router;
