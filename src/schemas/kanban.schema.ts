import { z } from 'zod';

export const createColunaSchema = z.object({
  nome: z.string().min(1, 'Nome da coluna é obrigatório'),
});

export const updateColunaSchema = z.object({
  nome: z.string().min(1, 'Nome da coluna é obrigatório'),
});

export const reorderColunasSchema = z.object({
  colunas: z.array(
    z.object({
      id: z.string().uuid(),
      ordem: z.number().int().min(0),
    })
  ),
});

export const moverPedidoSchema = z.object({
  kanbanColunaId: z.string().uuid().nullable(),
});

export type CreateColunaInput = z.infer<typeof createColunaSchema>;
export type UpdateColunaInput = z.infer<typeof updateColunaSchema>;
export type ReorderColunasInput = z.infer<typeof reorderColunasSchema>;
export type MoverPedidoInput = z.infer<typeof moverPedidoSchema>;
