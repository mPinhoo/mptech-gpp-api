import { Request, Response, NextFunction } from 'express';
import { pedidosService } from '../services/pedidos.service.js';

export class PublicController {
  async getPedido(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.params.token as string;
      const result = await pedidosService.findByToken(token);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async aceitarPedido(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.params.token as string;
      const result = await pedidosService.aceitarByToken(token);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}

export const publicController = new PublicController();
