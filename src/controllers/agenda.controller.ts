import { Request, Response, NextFunction } from 'express';
import { agendaService } from '../services/agenda.service.js';
import { getUserId } from '../utils/tenant.js';

export class AgendaController {
  async findByRange(req: Request, res: Response, next: NextFunction) {
    try {
      const { de, ate } = req.query;

      if (!de || !ate) {
        res.status(400).json({
          success: false,
          message: 'Parâmetros de e ate são obrigatórios',
        });
        return;
      }

      const result = await agendaService.findByRange(
        getUserId(req),
        de as string,
        ate as string
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async findByDay(req: Request, res: Response, next: NextFunction) {
    try {
      const { data } = req.query;

      if (!data) {
        res.status(400).json({
          success: false,
          message: 'Parâmetro data é obrigatório',
        });
        return;
      }

      const result = await agendaService.findByDay(getUserId(req), data as string);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async findPedidosByRange(req: Request, res: Response, next: NextFunction) {
    try {
      const { de, ate } = req.query;

      if (!de || !ate) {
        res.status(400).json({
          success: false,
          message: 'Parâmetros de e ate são obrigatórios',
        });
        return;
      }

      const result = await agendaService.findPedidosByRange(
        getUserId(req),
        de as string,
        ate as string
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await agendaService.create(getUserId(req), req.body);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const result = await agendaService.update(getUserId(req), id, req.body);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      await agendaService.delete(getUserId(req), id);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
}

export const agendaController = new AgendaController();
