import { Request, Response, NextFunction } from 'express';
import { supportService } from '../services/support.service.js';

export class SupportController {
  async contact(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await supportService.contact(req.body);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}

export const supportController = new SupportController();
