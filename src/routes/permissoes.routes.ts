import { Router } from 'express';
import { permissoesController } from '../controllers/permissoes.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  createGrupoPermissaoSchema,
  updateGrupoPermissaoSchema,
} from '../schemas/permissoes.schema.js';

const router = Router();

router.get('/grupos', permissoesController.findAllGrupos);
router.get('/grupos/:id', permissoesController.findGrupoById);
router.post('/grupos', validate({ body: createGrupoPermissaoSchema }), permissoesController.createGrupo);
router.put(
  '/grupos/:id',
  validate({ body: updateGrupoPermissaoSchema }),
  permissoesController.updateGrupo
);
router.delete('/grupos/:id', permissoesController.deleteGrupo);

export default router;
