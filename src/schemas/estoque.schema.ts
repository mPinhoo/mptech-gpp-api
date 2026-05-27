import { z } from 'zod';

export const entradaEstoqueSchema = z.object({
  produtoId: z.string().uuid('ID do produto inválido'),
  quantidade: z.number().int().positive('Quantidade deve ser positiva'),
});

export const saidaEstoqueSchema = z.object({
  produtoId: z.string().uuid('ID do produto inválido'),
  quantidade: z.number().int().positive('Quantidade deve ser positiva'),
});

export const updateEstoqueSchema = z.object({
  quantidadeMinima: z.number().int().min(0).optional(),
  unidade: z.string().min(1).optional(),
});

export type EntradaEstoqueInput = z.infer<typeof entradaEstoqueSchema>;
export type SaidaEstoqueInput = z.infer<typeof saidaEstoqueSchema>;
export type UpdateEstoqueInput = z.infer<typeof updateEstoqueSchema>;
