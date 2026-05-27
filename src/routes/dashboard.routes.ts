import { Router } from 'express';
import { dashboardController } from '../controllers/dashboard.controller.js';

const router = Router();

router.get('/stats', dashboardController.getStats);
router.get('/chart', dashboardController.getChart);

export default router;
