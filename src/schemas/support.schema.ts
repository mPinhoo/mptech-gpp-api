import { z } from 'zod';

export const supportContactSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  telefone: z.string().min(8, 'Telefone inválido'),
  descricao: z.string().min(10, 'Descrição deve ter no mínimo 10 caracteres'),
});

export type SupportContactInput = z.infer<typeof supportContactSchema>;
