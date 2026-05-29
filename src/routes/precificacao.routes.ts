import { Router } from 'express';
import { precificacaoController } from '../controllers/precificacao.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { updateConfigPrecificacaoSchema } from '../schemas/precificacao.schema.js';

const router = Router();

router.get('/', precificacaoController.getConfig);
router.put('/', validate({ body: updateConfigPrecificacaoSchema }), precificacaoController.updateConfig);

export default router;
