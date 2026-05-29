import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import authRoutes from './auth.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import produtosRoutes from './produtos.routes.js';
import estoqueRoutes from './estoque.routes.js';
import pedidosRoutes from './pedidos.routes.js';
import clientesRoutes from './clientes.routes.js';
import precificacaoRoutes from './precificacao.routes.js';
import kanbanRoutes from './kanban.routes.js';
import notificacoesRoutes from './notificacoes.routes.js';
import agendaRoutes from './agenda.routes.js';
import publicRoutes from './public.routes.js';
import supportRoutes from './support.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/public', publicRoutes);
router.use('/support', supportRoutes);

router.use('/dashboard', authMiddleware, dashboardRoutes);
router.use('/produtos', authMiddleware, produtosRoutes);
router.use('/estoque', authMiddleware, estoqueRoutes);
router.use('/pedidos', authMiddleware, pedidosRoutes);
router.use('/clientes', authMiddleware, clientesRoutes);
router.use('/precificacao', authMiddleware, precificacaoRoutes);
router.use('/kanban', authMiddleware, kanbanRoutes);
router.use('/notificacoes', authMiddleware, notificacoesRoutes);
router.use('/agenda', authMiddleware, agendaRoutes);

export default router;
