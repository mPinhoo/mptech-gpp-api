import { Request, Response, NextFunction } from 'express';
import { chatService } from '../services/chat.service.js';
import type { ChatRequestInput } from '../schemas/chat.schema.js';

export class ChatController {
  async ask(req: Request, res: Response, next: NextFunction) {
    try {
      const { message, history } = req.body as ChatRequestInput;
      const result = await chatService.ask(message, history);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async status(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = chatService.getStatus();
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}

export const chatController = new ChatController();
