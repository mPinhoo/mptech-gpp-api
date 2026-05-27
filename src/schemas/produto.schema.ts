import { z } from 'zod';

export const createProdutoSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  categoria: z.string().min(2, 'Categoria deve ter no mínimo 2 caracteres'),
  preco: z.number().positive('Preço deve ser positivo'),
  ativo: z.boolean().optional().default(true),
});

export const updateProdutoSchema = z.object({
  nome: z.string().min(2).optional(),
  categoria: z.string().min(2).optional(),
  preco: z.number().positive().optional(),
  ativo: z.boolean().optional(),
});

export type CreateProdutoInput = z.infer<typeof createProdutoSchema>;
export type UpdateProdutoInput = z.infer<typeof updateProdutoSchema>;
