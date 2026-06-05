import { Router } from 'express';
import { chatController } from '../controllers/chat.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { chatRequestSchema } from '../schemas/chat.schema.js';

const router = Router();

router.get('/status', chatController.status);
router.post('/', validate({ body: chatRequestSchema }), chatController.ask);

export default router;
