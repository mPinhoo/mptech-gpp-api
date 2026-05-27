import { z } from 'zod';

const itemPedidoSchema = z.object({
  produtoId: z.string().uuid('ID do produto inválido'),
  quantidade: z.number().int().positive('Quantidade deve ser positiva'),
});

export const createPedidoSchema = z.object({
  numero: z.string().min(1, 'Número do pedido é obrigatório'),
  clienteId: z.string().uuid('ID do cliente inválido'),
  dataPedido: z.string().refine((val) => !isNaN(Date.parse(val)), 'Data inválida'),
  prazoEntrega: z.string().refine((val) => !isNaN(Date.parse(val)), 'Prazo inválido'),
  itens: z.array(itemPedidoSchema).min(1, 'Pedido deve ter pelo menos 1 item'),
});

export const updatePedidoSchema = z.object({
  numero: z.string().min(1).optional(),
  clienteId: z.string().uuid().optional(),
  dataPedido: z.string().refine((val) => !isNaN(Date.parse(val))).optional(),
  prazoEntrega: z.string().refine((val) => !isNaN(Date.parse(val))).optional(),
  itens: z.array(itemPedidoSchema).min(1).optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum(['PENDENTE', 'APROVADO', 'CONCLUIDO', 'CANCELADO']),
});

export type CreatePedidoInput = z.infer<typeof createPedidoSchema>;
export type UpdatePedidoInput = z.infer<typeof updatePedidoSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
