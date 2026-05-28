import { Request, Response, NextFunction } from 'express';
import { kanbanService } from '../services/kanban.service.js';

export class KanbanController {
  async getColunas(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await kanbanService.getColunas();
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async createColuna(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await kanbanService.createColuna(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async updateColuna(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await kanbanService.updateColuna(req.params.id as string, req.body);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async reorderColunas(req: Request, res: Response, next: NextFunction) {
    try {
      await kanbanService.reorderColunas(req.body);
      res.json({ success: true, data: { message: 'Colunas reordenadas' } });
    } catch (err) {
      next(err);
    }
  }

  async deleteColuna(req: Request, res: Response, next: NextFunction) {
    try {
      await kanbanService.deleteColuna(req.params.id as string);
      res.json({ success: true, data: { message: 'Coluna excluída' } });
    } catch (err) {
      next(err);
    }
  }

  async moverPedido(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await kanbanService.moverPedido(
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
