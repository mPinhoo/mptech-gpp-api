import { Router } from 'express';
import { estoqueController } from '../controllers/estoque.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  createMateriaPrimaSchema,
  entradaEstoqueSchema,
  saidaEstoqueSchema,
  updateEstoqueSchema,
} from '../schemas/estoque.schema.js';

const router = Router();

router.get('/', estoqueController.findAll);
router.get('/:id', estoqueController.findById);
router.post('/', validate({ body: createMateriaPrimaSchema }), estoqueController.create);
router.post('/entrada', validate({ body: entradaEstoqueSchema }), estoqueController.entrada);
router.post('/saida', validate({ body: saidaEstoqueSchema }), estoqueController.saida);
router.put('/:id', validate({ body: updateEstoqueSchema }), estoqueController.update);

export default router;
