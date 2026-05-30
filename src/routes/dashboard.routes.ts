import { Router } from 'express';
import { dashboardController } from '../controllers/dashboard.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { dashboardPeriodSchema } from '../schemas/dashboard.schema.js';

const router = Router();

router.get(
  '/stats',
  validate({ query: dashboardPeriodSchema }),
  dashboardController.getStats
);
router.get(
  '/chart',
  validate({ query: dashboardPeriodSchema }),
  dashboardController.getChart
);

export default router;
