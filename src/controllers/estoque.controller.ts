import { Request, Response, NextFunction } from 'express';
import { estoqueService } from '../services/estoque.service.js';

export class EstoqueController {
  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      const { search, page, limit } = req.query;
      const result = await estoqueService.findAll({
        search: search as string | undefined,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const result = await estoqueService.findById(id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async entrada(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await estoqueService.entrada(req.body);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async saida(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await estoqueService.saida(req.body);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const result = await estoqueService.update(id, req.body);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}

export const estoqueController = new EstoqueController();
