import { z } from 'zod';

export const createMateriaPrimaSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  unidade: z.string().min(1, 'Unidade é obrigatória'),
  precoCusto: z.number().min(0, 'Preço de custo deve ser positivo'),
  quantidade: z.number().int().min(0).optional().default(0),
  quantidadeMinima: z.number().int().min(0).optional().default(0),
});

export const entradaEstoqueSchema = z.object({
  materiaPrimaId: z.string().uuid('ID da matéria-prima inválido'),
  quantidade: z.number().int().positive('Quantidade deve ser positiva'),
});

export const saidaEstoqueSchema = z.object({
  materiaPrimaId: z.string().uuid('ID da matéria-prima inválido'),
  quantidade: z.number().int().positive('Quantidade deve ser positiva'),
});

export const updateEstoqueSchema = z.object({
  nome: z.string().min(2).optional(),
  unidade: z.string().min(1).optional(),
  precoCusto: z.number().min(0).optional(),
  quantidadeMinima: z.number().int().min(0).optional(),
});

export type CreateMateriaPrimaInput = z.infer<typeof createMateriaPrimaSchema>;
export type EntradaEstoqueInput = z.infer<typeof entradaEstoqueSchema>;
export type SaidaEstoqueInput = z.infer<typeof saidaEstoqueSchema>;
export type UpdateEstoqueInput = z.infer<typeof updateEstoqueSchema>;
