import { Router } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma.js';
import { getUserId } from '../utils/tenant.js';
import { AppError } from '../utils/errors.js';
import { isPushServiceEndpoint, pushPublicKey } from '../services/web-push.service.js';

const router = Router();

const MAX_SUBSCRIPTIONS_PER_USER = 10;
const base64url = z.string().regex(/^[A-Za-z0-9_-]+={0,2}$/).max(200);
const subscriptionSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: base64url, auth: base64url }),
});

router.get('/chave', (_req, res) => {
  res.json({ success: true, data: { publicKey: pushPublicKey() } });
});

router.post('/inscricoes', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!pushPublicKey())
      throw new AppError('Notificações push indisponíveis.', 503, 'PUSH_UNAVAILABLE');
    const { endpoint, keys } = subscriptionSchema.parse(req.body);
    if (!isPushServiceEndpoint(endpoint))
      throw new AppError('Endereço de notificação inválido.', 422, 'INVALID_PUSH_ENDPOINT');
    // A device belongs to whoever signed in on it last.
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
      update: { userId, p256dh: keys.p256dh, auth: keys.auth },
    });
    const stale = await prisma.pushSubscription.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      skip: MAX_SUBSCRIPTIONS_PER_USER,
      select: { id: true },
    });
    if (stale.length)
      await prisma.pushSubscription.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
    res.status(201).json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
});

router.delete('/inscricoes', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const { endpoint } = z.object({ endpoint: z.string().url().max(1000) }).parse(req.body);
    await prisma.pushSubscription.deleteMany({ where: { endpoint, userId } });
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
});

export default router;
