import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { permissionMiddleware } from '../middlewares/permission.middleware.js';
import authRoutes from './auth.routes.js';
import usersRoutes from './users.routes.js';
import permissoesRoutes from './permissoes.routes.js';
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

const router = Router();

router.use('/auth', authRoutes);
router.use('/public', publicRoutes);

const protectedRoute = [authMiddleware, permissionMiddleware] as const;

router.use('/users', ...protectedRoute, usersRoutes);
router.use('/permissoes', ...protectedRoute, permissoesRoutes);
router.use('/dashboard', ...protectedRoute, dashboardRoutes);
router.use('/produtos', ...protectedRoute, produtosRoutes);
router.use('/estoque', ...protectedRoute, estoqueRoutes);
router.use('/pedidos', ...protectedRoute, pedidosRoutes);
router.use('/clientes', ...protectedRoute, clientesRoutes);
router.use('/precificacao', ...protectedRoute, precificacaoRoutes);
router.use('/kanban', ...protectedRoute, kanbanRoutes);
router.use('/notificacoes', ...protectedRoute, notificacoesRoutes);
router.use('/agenda', ...protectedRoute, agendaRoutes);

export default router;
