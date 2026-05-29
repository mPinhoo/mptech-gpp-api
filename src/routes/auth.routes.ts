import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { loginSchema, registerSchema, updateProfileSchema, forgotPasswordSchema, resetPasswordSchema } from '../schemas/auth.schema.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/login', validate({ body: loginSchema }), authController.login);
router.post('/register', validate({ body: registerSchema }), authController.register);
router.post('/forgot-password', validate({ body: forgotPasswordSchema }), authController.forgotPassword);
router.post('/reset-password', validate({ body: resetPasswordSchema }), authController.resetPassword);
router.get('/me', authMiddleware, authController.me);
router.put('/profile', authMiddleware, validate({ body: updateProfileSchema }), authController.updateProfile);

export default router;
