import { Request, Response, NextFunction } from 'express';
import { usersService } from '../services/users.service.js';
import { authService } from '../services/auth.service.js';
import { getUserId } from '../utils/tenant.js';

export class UsersController {
  async findAll(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = await usersService.findAll();
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await usersService.create(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const result = await usersService.update(id, req.body);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async impersonate(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.impersonate(
        getUserId(req),
        req.user!.email,
        req.params.id as string
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}

export const usersController = new UsersController();
