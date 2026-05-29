import { Router } from 'express';
import { notificacoesController } from '../controllers/notificacoes.controller.js';

const router = Router();

router.get('/', notificacoesController.listUnread);
router.get('/contagem', notificacoesController.countUnread);
router.patch('/:id/lida', notificacoesController.markAsRead);

export default router;
