import { Router } from 'express';
import { publicController } from '../controllers/public.controller.js';

const router = Router();

router.get('/pedidos/:token', publicController.getPedido);
router.post('/pedidos/:token/aceitar', publicController.aceitarPedido);

export default router;
