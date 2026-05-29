import { Request, Response, NextFunction } from 'express';
import { produtosService } from '../services/produtos.service.js';
import { getUserId } from '../utils/tenant.js';

export class ProdutosController {
  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, search, nome, categoria, page, limit, sortBy, sortOrder } = req.query;
      const result = await produtosService.findAll(getUserId(req), {
        status: status as string | undefined,
        search: search as string | undefined,
        nome: nome as string | undefined,
        categoria: categoria as string | undefined,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        sortBy: sortBy as string | undefined,
        sortOrder: sortOrder as 'asc' | 'desc' | undefined,
      });
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const result = await produtosService.findById(getUserId(req), id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await produtosService.create(getUserId(req), req.body);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const result = await produtosService.update(getUserId(req), id, req.body);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      await produtosService.delete(getUserId(req), id);
      res.json({ success: true, data: { message: 'Produto desativado com sucesso' } });
    } catch (err) {
      next(err);
    }
  }
}

export const produtosController = new ProdutosController();
