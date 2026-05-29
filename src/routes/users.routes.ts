import { Router } from 'express';
import { usersController } from '../controllers/users.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { createUserSchema } from '../schemas/users.schema.js';

const router = Router();

router.get('/', usersController.findAll);
router.post('/', validate({ body: createUserSchema }), usersController.create);

export default router;
