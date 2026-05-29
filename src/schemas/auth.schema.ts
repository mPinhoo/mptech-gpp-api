import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  senha: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

export const registerSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  email: z.string().email('Email inválido'),
  senha: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

export const updateProfileSchema = z
  .object({
    nome: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').optional(),
    avatarUrl: z.string().nullable().optional(),
    senhaAtual: z.string().min(6, 'Senha atual inválida').optional(),
    novaSenha: z.string().min(6, 'Nova senha deve ter no mínimo 6 caracteres').optional(),
  })
  .refine(
    (data) => {
      if (data.novaSenha && !data.senhaAtual) {
        return false;
      }
      return true;
    },
    { message: 'Informe a senha atual para alterar a senha', path: ['senhaAtual'] }
  );

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
