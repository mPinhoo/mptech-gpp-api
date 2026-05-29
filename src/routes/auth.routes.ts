import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { loginSchema, registerSchema, updateProfileSchema } from '../schemas/auth.schema.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/login', validate({ body: loginSchema }), authController.login);
router.post('/register', validate({ body: registerSchema }), authController.register);
router.get('/me', authMiddleware, authController.me);
router.put('/profile', authMiddleware, validate({ body: updateProfileSchema }), authController.updateProfile);

export default router;
