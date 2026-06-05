import { z } from 'zod';

const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(4000),
});

export const chatRequestSchema = z.object({
  message: z.string().min(1, 'Mensagem é obrigatória').max(2000),
  history: z.array(chatMessageSchema).max(20).optional().default([]),
});

export type ChatRequestInput = z.infer<typeof chatRequestSchema>;
