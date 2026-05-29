import { Request, Response, NextFunction } from 'express';
import { clientesService } from '../services/clientes.service.js';
import { getUserId } from '../utils/tenant.js';

export class ClientesController {
  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      const { search, page, limit } = req.query;
      const result = await clientesService.findAll(getUserId(req), {
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
      const result = await clientesService.findById(getUserId(req), id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await clientesService.create(getUserId(req), req.body);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const result = await clientesService.update(getUserId(req), id, req.body);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      await clientesService.delete(getUserId(req), id);
      res.json({ success: true, data: { message: 'Cliente desativado com sucesso' } });
    } catch (err) {
      next(err);
    }
  }
}

export const clientesController = new ClientesController();
