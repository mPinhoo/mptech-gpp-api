import { Request, Response, NextFunction } from 'express';
import { kanbanService } from '../services/kanban.service.js';
import { getUserId } from '../utils/tenant.js';

export class KanbanController {
  async getColunas(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await kanbanService.getColunas(getUserId(req));
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async createColuna(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await kanbanService.createColuna(getUserId(req), req.body);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async updateColuna(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await kanbanService.updateColuna(
        getUserId(req),
        req.params.id as string,
        req.body
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async reorderColunas(req: Request, res: Response, next: NextFunction) {
    try {
      await kanbanService.reorderColunas(getUserId(req), req.body);
      res.json({ success: true, data: { message: 'Colunas reordenadas' } });
    } catch (err) {
      next(err);
    }
  }

  async deleteColuna(req: Request, res: Response, next: NextFunction) {
    try {
      await kanbanService.deleteColuna(getUserId(req), req.params.id as string);
      res.json({ success: true, data: { message: 'Coluna excluída' } });
    } catch (err) {
      next(err);
    }
  }

  async moverPedido(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await kanbanService.moverPedido(
        getUserId(req),
        req.params.id as string,
        req.body.kanbanColunaId
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}

export const kanbanController = new KanbanController();
