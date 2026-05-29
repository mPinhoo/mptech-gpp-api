import { Router } from 'express';
import { supportController } from '../controllers/support.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { supportContactSchema } from '../schemas/support.schema.js';

const router = Router();

router.post('/contact', validate({ body: supportContactSchema }), supportController.contact);

export default router;
