import { Request, Response, NextFunction } from 'express';
import { notificacoesService } from '../services/notificacoes.service.js';
import {
  subscribeNotificationEvents,
  type NotificationEvent,
} from '../services/notification-events.js';
import { getUserId } from '../utils/tenant.js';

const MAX_STREAMS_PER_USER = 5;
const HEARTBEAT_MS = 25_000;
// Streams are re-opened periodically so the token is verified again.
const STREAM_LIFETIME_MS = 55 * 60_000;
const openStreams = new Map<string, Set<Response>>();

export class NotificacoesController {
  async listRecent(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      const [data, naoLidas] = await Promise.all([
        notificacoesService.findRecent(userId),
        notificacoesService.countUnread(userId),
      ]);
      res.json({ success: true, data, meta: { naoLidas } });
    } catch (err) {
      next(err);
    }
  }

  async countUnread(req: Request, res: Response, next: NextFunction) {
    try {
      const count = await notificacoesService.countUnread(getUserId(req));
      res.json({ success: true, data: { count } });
    } catch (err) {
      next(err);
    }
  }

  async markAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      await notificacoesService.markAsRead(getUserId(req), req.params.id as string);
      res.json({ success: true, data: null });
    } catch (err) {
      next(err);
    }
  }

  async markAllAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const atualizadas = await notificacoesService.markAllAsRead(getUserId(req));
      res.json({ success: true, data: { atualizadas } });
    } catch (err) {
      next(err);
    }
  }

  async archive(req: Request, res: Response, next: NextFunction) {
    try {
      await notificacoesService.archive(getUserId(req), req.params.id as string);
      res.json({ success: true, data: null });
    } catch (err) {
      next(err);
    }
  }

  async archiveAll(req: Request, res: Response, next: NextFunction) {
    try {
      const removidas = await notificacoesService.archiveAll(getUserId(req));
      res.json({ success: true, data: { removidas } });
    } catch (err) {
      next(err);
    }
  }

  /** Server-Sent Events: carries only ids and sync signals; data is read via the API. */
  stream(req: Request, res: Response) {
    const userId = getUserId(req);
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(': conectado\n\n');

    const streams = openStreams.get(userId) ?? new Set<Response>();
    openStreams.set(userId, streams);
    if (streams.size >= MAX_STREAMS_PER_USER) streams.values().next().value?.end();
    streams.add(res);

    const send = (event: NotificationEvent) =>
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    const unsubscribe = subscribeNotificationEvents(userId, send);
    const heartbeat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS);
    const lifetime = setTimeout(() => res.end(), STREAM_LIFETIME_MS);

    let closed = false;
    const cleanup = () => {
      if (closed) return;
      closed = true;
      clearInterval(heartbeat);
      clearTimeout(lifetime);
      unsubscribe();
      streams.delete(res);
      if (!streams.size) openStreams.delete(userId);
    };
    res.on('close', cleanup);
    res.on('finish', cleanup);
  }
}

export const notificacoesController = new NotificacoesController();
