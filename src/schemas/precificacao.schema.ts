import { z } from 'zod';

const materialSchema = z.object({
  nome: z.string().min(1, 'Nome do material é obrigatório'),
  custoUnitario: z.number().min(0, 'Custo unitário deve ser >= 0'),
  quantidade: z.number().min(0, 'Quantidade deve ser >= 0'),
});

const custoFixoSchema = z.object({
  nome: z.string().min(1, 'Nome do custo é obrigatório'),
  valor: z.number().min(0, 'Valor deve ser >= 0'),
});

const extraSchema = z.object({
  nome: z.string().min(1, 'Nome do extra é obrigatório'),
  valor: z.number().min(0, 'Valor deve ser >= 0'),
});

export const createPrecificacaoSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  categoria: z.string().optional(),
  descricao: z.string().optional(),
  clienteId: z.string().uuid().optional().nullable(),
  observacoes: z.string().optional(),
  tempoProducao: z.number().min(0).default(0),
  valorHora: z.number().min(0).default(0),
  taxaMarketplace: z.number().min(0).max(100).default(0),
  taxaCartao: z.number().min(0).max(100).default(0),
  impostos: z.number().min(0).max(100).default(0),
  taxasAdicionais: z.number().min(0).max(100).default(0),
  margemLucro: z.number().min(0).max(100).default(0),
  quantidade: z.number().int().min(1).default(1),
  status: z.enum(['RASCUNHO', 'FINALIZADO']).optional().default('RASCUNHO'),
  materiais: z.array(materialSchema).default([]),
  custosFixos: z.array(custoFixoSchema).default([]),
  extras: z.array(extraSchema).default([]),
});

export const updatePrecificacaoSchema = z.object({
  nome: z.string().min(2).optional(),
  categoria: z.string().optional().nullable(),
  descricao: z.string().optional().nullable(),
  clienteId: z.string().uuid().optional().nullable(),
  observacoes: z.string().optional().nullable(),
  tempoProducao: z.number().min(0).optional(),
  valorHora: z.number().min(0).optional(),
  taxaMarketplace: z.number().min(0).max(100).optional(),
  taxaCartao: z.number().min(0).max(100).optional(),
  impostos: z.number().min(0).max(100).optional(),
  taxasAdicionais: z.number().min(0).max(100).optional(),
  margemLucro: z.number().min(0).max(100).optional(),
  quantidade: z.number().int().min(1).optional(),
  status: z.enum(['RASCUNHO', 'FINALIZADO']).optional(),
  materiais: z.array(materialSchema).optional(),
  custosFixos: z.array(custoFixoSchema).optional(),
  extras: z.array(extraSchema).optional(),
});

export const calcularPrecificacaoSchema = z.object({
  tempoProducao: z.number().min(0).default(0),
  valorHora: z.number().min(0).default(0),
  taxaMarketplace: z.number().min(0).max(100).default(0),
  taxaCartao: z.number().min(0).max(100).default(0),
  impostos: z.number().min(0).max(100).default(0),
  taxasAdicionais: z.number().min(0).max(100).default(0),
  margemLucro: z.number().min(0).max(100).default(0),
  quantidade: z.number().int().min(1).default(1),
  materiais: z.array(materialSchema).default([]),
  custosFixos: z.array(custoFixoSchema).default([]),
  extras: z.array(extraSchema).default([]),
});

export type CreatePrecificacaoInput = z.infer<typeof createPrecificacaoSchema>;
export type UpdatePrecificacaoInput = z.infer<typeof updatePrecificacaoSchema>;
export type CalcularPrecificacaoInput = z.infer<typeof calcularPrecificacaoSchema>;
