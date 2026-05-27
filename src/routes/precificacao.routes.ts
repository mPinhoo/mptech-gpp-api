import { Router } from 'express';
import { precificacaoController } from '../controllers/precificacao.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  createPrecificacaoSchema,
  updatePrecificacaoSchema,
  calcularPrecificacaoSchema,
} from '../schemas/precificacao.schema.js';

const router = Router();

router.get('/', precificacaoController.findAll);
router.get('/:id', precificacaoController.findById);
router.post('/', validate({ body: createPrecificacaoSchema }), precificacaoController.create);
router.post('/calcular', validate({ body: calcularPrecificacaoSchema }), precificacaoController.calcular);
router.post('/:id/duplicar', precificacaoController.duplicate);
router.put('/:id', validate({ body: updatePrecificacaoSchema }), precificacaoController.update);
router.delete('/:id', precificacaoController.delete);

export default router;
