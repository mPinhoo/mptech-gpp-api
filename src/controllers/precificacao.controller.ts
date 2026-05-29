import { Request, Response, NextFunction } from 'express';
import { precificacaoService } from '../services/precificacao.service.js';
import { getUserId } from '../utils/tenant.js';

export class PrecificacaoController {
  async getConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await precificacaoService.getConfig(getUserId(req));
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async updateConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await precificacaoService.updateConfig(getUserId(req), req.body);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}

export const precificacaoController = new PrecificacaoController();
