import { z } from 'zod';

export const createUserSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  email: z.string().email('Email inválido'),
  senha: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  grupoPermissaoId: z.string().uuid().nullable().optional(),
});

export const updateUserSchema = z.object({
  grupoPermissaoId: z.string().uuid().nullable(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
