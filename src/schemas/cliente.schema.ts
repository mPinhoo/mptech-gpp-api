import { z } from 'zod';

export const createClienteSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  telefone: z.string().optional().or(z.literal('')),
  documento: z.string().optional().or(z.literal('')),
  endereco: z.string().optional().or(z.literal('')),
});

export const updateClienteSchema = z.object({
  nome: z.string().min(2).optional(),
  email: z.string().email().optional().or(z.literal('')),
  telefone: z.string().optional().or(z.literal('')),
  documento: z.string().optional().or(z.literal('')),
  endereco: z.string().optional().or(z.literal('')),
});

export type CreateClienteInput = z.infer<typeof createClienteSchema>;
export type UpdateClienteInput = z.infer<typeof updateClienteSchema>;
