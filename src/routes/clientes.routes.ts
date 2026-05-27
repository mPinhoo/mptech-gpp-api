import { Router } from 'express';
import { clientesController } from '../controllers/clientes.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { createClienteSchema, updateClienteSchema } from '../schemas/cliente.schema.js';

const router = Router();

router.get('/', clientesController.findAll);
router.get('/:id', clientesController.findById);
router.post('/', validate({ body: createClienteSchema }), clientesController.create);
router.put('/:id', validate({ body: updateClienteSchema }), clientesController.update);
router.delete('/:id', clientesController.delete);

export default router;
