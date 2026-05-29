import { Router } from 'express';
import { agendaController } from '../controllers/agenda.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { createLembreteSchema, updateLembreteSchema } from '../schemas/agenda.schema.js';

const router = Router();

router.get('/', agendaController.findByRange);
router.get('/dia', agendaController.findByDay);
router.post('/', validate({ body: createLembreteSchema }), agendaController.create);
router.put('/:id', validate({ body: updateLembreteSchema }), agendaController.update);
router.delete('/:id', agendaController.delete);

export default router;
