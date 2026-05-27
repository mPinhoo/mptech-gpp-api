import { Router } from 'express';
import { pedidosController } from '../controllers/pedidos.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { createPedidoSchema, updatePedidoSchema, updateStatusSchema } from '../schemas/pedido.schema.js';

const router = Router();

router.get('/', pedidosController.findAll);
router.get('/:id', pedidosController.findById);
router.post('/', validate({ body: createPedidoSchema }), pedidosController.create);
router.put('/:id', validate({ body: updatePedidoSchema }), pedidosController.update);
router.put('/:id/status', validate({ body: updateStatusSchema }), pedidosController.updateStatus);
router.post('/:id/enviar', pedidosController.enviar);
router.delete('/:id', pedidosController.delete);

export default router;
