import { Request, Response, NextFunction } from 'express';
import { pedidosService } from '../services/pedidos.service.js';
import { getUserId } from '../utils/tenant.js';

export class PedidosController {
  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, search, page, limit } = req.query;
      const result = await pedidosService.findAll(getUserId(req), {
        status: status as string | undefined,
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
      const result = await pedidosService.findById(getUserId(req), id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await pedidosService.create(getUserId(req), req.body);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const result = await pedidosService.update(getUserId(req), id, req.body);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const result = await pedidosService.updateStatus(getUserId(req), id, req.body.status);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async enviar(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const result = await pedidosService.enviar(getUserId(req), id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const result = await pedidosService.cancel(getUserId(req), id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}

export const pedidosController = new PedidosController();
