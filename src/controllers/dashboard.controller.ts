import { Request, Response, NextFunction } from 'express';
import { dashboardService } from '../services/dashboard.service.js';
import { getUserId } from '../utils/tenant.js';
import type { DashboardPeriodQuery } from '../schemas/dashboard.schema.js';

export class DashboardController {
  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const { dataDe, dataAte } = req.query as DashboardPeriodQuery;
      const result = await dashboardService.getStats(getUserId(req), dataDe, dataAte);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async getChart(req: Request, res: Response, next: NextFunction) {
    try {
      const { dataDe, dataAte } = req.query as DashboardPeriodQuery;
      const result = await dashboardService.getChart(getUserId(req), dataDe, dataAte);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}

export const dashboardController = new DashboardController();
