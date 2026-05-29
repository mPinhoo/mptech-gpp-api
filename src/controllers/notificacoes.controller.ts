import { Request, Response, NextFunction } from 'express';
import { notificacoesService } from '../services/notificacoes.service.js';
import { getUserId } from '../utils/tenant.js';

export class NotificacoesController {
  async listUnread(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await notificacoesService.findUnread(getUserId(req));
      res.json({ success: true, data });
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
}

export const notificacoesController = new NotificacoesController();
