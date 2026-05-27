import { Router } from 'express';
import { produtosController } from '../controllers/produtos.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { createProdutoSchema, updateProdutoSchema } from '../schemas/produto.schema.js';

const router = Router();

router.get('/', produtosController.findAll);
router.get('/:id', produtosController.findById);
router.post('/', validate({ body: createProdutoSchema }), produtosController.create);
router.put('/:id', validate({ body: updateProdutoSchema }), produtosController.update);
router.delete('/:id', produtosController.delete);

export default router;
