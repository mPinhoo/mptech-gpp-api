import { Request, Response, NextFunction } from 'express';
import { precificacaoService } from '../services/precificacao.service.js';

export class PrecificacaoController {
  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      const { search, clienteId, status, page, limit } = req.query;
      const result = await precificacaoService.findAll({
        search: search as string | undefined,
        clienteId: clienteId as string | undefined,
        status: status as string | undefined,
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
      const result = await precificacaoService.findById(req.params.id as string);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await precificacaoService.create(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async calcular(req: Request, res: Response, next: NextFunction) {
    try {
      const result = precificacaoService.calcular(req.body);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await precificacaoService.update(req.params.id as string, req.body);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async duplicate(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await precificacaoService.duplicate(req.params.id as string);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await precificacaoService.delete(req.params.id as string);
      res.json({ success: true, data: { message: 'Precificação excluída com sucesso' } });
    } catch (err) {
      next(err);
    }
  }
}

export const precificacaoController = new PrecificacaoController();
