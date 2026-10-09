import { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../utils/prisma.js';
import { AppError } from '../utils/errors.js';
import { graceDays } from './config.js';
import { hasAccess } from './state.js';
import { lock } from './checkout.js';

export async function billingAccess(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { ativo: true, billingManaged: true },
    });
    if (!user?.ativo) throw new AppError('Conta inativa.', 403);
    if (user.billingManaged) {
      const sub = await prisma.subscription.findFirst({
        where: { empresa: { ownerId: req.user!.userId } },
        orderBy: { createdAt: 'desc' },
      });
      if (!sub || !hasAccess(sub, graceDays()))
        throw new AppError(
          'Regularize sua assinatura para continuar.',
          402,
          'SUBSCRIPTION_REQUIRED',
        );
      if (/\/api\/(users|permissoes)(\/|$)/.test(req.baseUrl + req.path))
        throw new AppError('Este plano não inclui administração global.', 403);
    }
    next();
  } catch (error) {
    next(error);
  }
}
type QuotaResource = 'clientes' | 'produtos' | 'pedidosPorMes';
type Db = Prisma.TransactionClient | typeof prisma;

function monthStart(now = new Date()) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
  }).format(now);
  return new Date(today.slice(0, 7) + '-01T00:00:00-03:00');
}
// Orders are counted by creation time, not their editable date, so backdated
// orders cannot bypass the monthly limit.
function usage(db: Db, userId: string, resource: QuotaResource) {
  if (resource === 'clientes') return db.cliente.count({ where: { userId } });
  if (resource === 'produtos') return db.produto.count({ where: { userId } });
  return db.pedido.count({
    where: { userId, createdAt: { gte: monthStart() } },
  });
}
export async function planUsage(userId: string) {
  const [clientes, produtos, pedidosPorMes] = await Promise.all([
    usage(prisma, userId, 'clientes'),
    usage(prisma, userId, 'produtos'),
    usage(prisma, userId, 'pedidosPorMes'),
  ]);
  return { clientes, produtos, pedidosPorMes };
}
// Serialize quota checks and inserts on the same tenant.
export async function withQuota<T>(
  userId: string,
  resource: QuotaResource,
  insert: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await lock(tx, 'quota:' + userId);
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { billingManaged: true },
    });
    if (user?.billingManaged) {
      const sub = await tx.subscription.findFirst({
        where: { empresa: { ownerId: userId } },
        orderBy: { createdAt: 'desc' },
        include: { plan: true },
      });
      if (!sub || !hasAccess(sub, graceDays()))
        throw new AppError('Assinatura indisponível.', 402, 'SUBSCRIPTION_REQUIRED');
      const limits = sub.plan.limits as Record<
        string,
        { value: number | null; status: string }
      >;
      const limit = limits[resource];
      if (!limit || limit.status !== 'disponivel')
        throw new AppError('Recurso indisponível neste plano.', 403, 'PLAN_FEATURE');
      if (limit.value !== null && (await usage(tx, userId, resource)) >= limit.value)
        throw new AppError(
          'Limite do plano atingido. Consulte sua assinatura para mudar de plano.',
          403,
          'PLAN_LIMIT',
        );
    }
    return insert(tx);
  });
}
