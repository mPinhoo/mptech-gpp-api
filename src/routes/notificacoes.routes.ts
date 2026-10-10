import { Router } from 'express';
import { notificacoesController } from '../controllers/notificacoes.controller.js';

const router = Router();

router.get('/', notificacoesController.listRecent);
router.get('/contagem', notificacoesController.countUnread);
router.get('/stream', notificacoesController.stream);
router.patch('/lidas', notificacoesController.markAllAsRead);
router.patch('/:id/lida', notificacoesController.markAsRead);
router.delete('/', notificacoesController.archiveAll);
router.delete('/:id', notificacoesController.archive);

export default router;
