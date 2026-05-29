import { z } from 'zod';

export const createUserSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  email: z.string().email('Email inválido'),
  senha: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
