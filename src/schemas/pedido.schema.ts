import { z } from 'zod';

const itemPedidoSchema = z.object({
  produtoId: z.string().uuid('ID do produto inválido'),
  quantidade: z.number().int().positive('Quantidade deve ser positiva'),
  precoUnitario: z.number().positive('Preço deve ser positivo').optional(),
});

const extraPedidoSchema = z.object({
  nome: z.string().min(1, 'Nome do extra é obrigatório'),
  valor: z.number().min(0, 'Valor deve ser >= 0'),
});

export const createPedidoSchema = z.object({
  clienteId: z.string().uuid('ID do cliente inválido'),
  dataPedido: z.string().refine((val) => !isNaN(Date.parse(val)), 'Data inválida'),
  prazoEntrega: z.string().refine((val) => !isNaN(Date.parse(val)), 'Prazo inválido'),
  itens: z.array(itemPedidoSchema).min(1, 'Pedido deve ter pelo menos 1 item'),
  extras: z.array(extraPedidoSchema).default([]),
});

export const updatePedidoSchema = z.object({
  numero: z.string().min(1).optional(),
  clienteId: z.string().uuid().optional(),
  dataPedido: z.string().refine((val) => !isNaN(Date.parse(val))).optional(),
  prazoEntrega: z.string().refine((val) => !isNaN(Date.parse(val))).optional(),
  itens: z.array(itemPedidoSchema).min(1).optional(),
  extras: z.array(extraPedidoSchema).optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum(['PENDENTE', 'APROVADO', 'CONCLUIDO', 'CANCELADO']),
});

export type CreatePedidoInput = z.infer<typeof createPedidoSchema>;
export type UpdatePedidoInput = z.infer<typeof updatePedidoSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
