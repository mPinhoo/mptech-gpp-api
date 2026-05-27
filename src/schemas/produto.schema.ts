import { z } from 'zod';

export const CATEGORIAS = ['Festa', 'Brindes', 'Outros', 'Empresas'] as const;
export const STATUS_PRODUTO = ['ATIVO', 'INATIVO', 'FORA_DE_CICLO'] as const;

export const createProdutoSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  categoria: z.enum(CATEGORIAS, { errorMap: () => ({ message: 'Categoria inválida' }) }),
  preco: z.number().positive('Preço deve ser positivo'),
  status: z.enum(STATUS_PRODUTO).optional().default('ATIVO'),
});

export const updateProdutoSchema = z.object({
  nome: z.string().min(2).optional(),
  categoria: z.enum(CATEGORIAS).optional(),
  preco: z.number().positive().optional(),
  status: z.enum(STATUS_PRODUTO).optional(),
});

export type CreateProdutoInput = z.infer<typeof createProdutoSchema>;
export type UpdateProdutoInput = z.infer<typeof updateProdutoSchema>;
