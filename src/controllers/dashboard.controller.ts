import { Request, Response, NextFunction } from 'express';
import { dashboardService } from '../services/dashboard.service.js';
import { getUserId } from '../utils/tenant.js';

export class DashboardController {
  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await dashboardService.getStats(getUserId(req));
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async getChart(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await dashboardService.getChart(getUserId(req));
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}

export const dashboardController = new DashboardController();
