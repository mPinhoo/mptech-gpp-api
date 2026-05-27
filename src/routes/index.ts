import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import authRoutes from './auth.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import produtosRoutes from './produtos.routes.js';
import estoqueRoutes from './estoque.routes.js';
import pedidosRoutes from './pedidos.routes.js';
import clientesRoutes from './clientes.routes.js';

const router = Router();

router.use('/auth', authRoutes);

router.use('/dashboard', authMiddleware, dashboardRoutes);
router.use('/produtos', authMiddleware, produtosRoutes);
router.use('/estoque', authMiddleware, estoqueRoutes);
router.use('/pedidos', authMiddleware, pedidosRoutes);
router.use('/clientes', authMiddleware, clientesRoutes);

export default router;
