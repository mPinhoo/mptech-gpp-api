import { Request, Response, NextFunction } from 'express';
import { permissoesService } from '../services/permissoes.service.js';

export class PermissoesController {
  async findAllGrupos(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = await permissoesService.findAllGrupos();
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async findGrupoById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const result = await permissoesService.findGrupoById(id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async createGrupo(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await permissoesService.createGrupo(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async updateGrupo(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const result = await permissoesService.updateGrupo(id, req.body);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async deleteGrupo(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      await permissoesService.deleteGrupo(id);
      res.json({ success: true, data: null });
    } catch (err) {
      next(err);
    }
  }
}

export const permissoesController = new PermissoesController();
