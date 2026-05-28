import { Router } from 'express';
import { kanbanController } from '../controllers/kanban.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  createColunaSchema,
  updateColunaSchema,
  reorderColunasSchema,
  moverPedidoSchema,
} from '../schemas/kanban.schema.js';

const router = Router();

router.get('/colunas', kanbanController.getColunas);
router.post('/colunas', validate({ body: createColunaSchema }), kanbanController.createColuna);
router.put('/colunas/reorder', validate({ body: reorderColunasSchema }), kanbanController.reorderColunas);
router.put('/colunas/:id', validate({ body: updateColunaSchema }), kanbanController.updateColuna);
router.delete('/colunas/:id', kanbanController.deleteColuna);
router.put('/pedidos/:id/mover', validate({ body: moverPedidoSchema }), kanbanController.moverPedido);

export default router;
