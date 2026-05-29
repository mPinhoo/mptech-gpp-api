import { z } from 'zod';

const custoFixoSchema = z.object({
  nome: z.string().min(1, 'Nome do custo é obrigatório'),
  valor: z.number().min(0, 'Valor deve ser >= 0'),
});

export const updateConfigPrecificacaoSchema = z.object({
  tempoProducao: z.number().min(0).default(0),
  valorHora: z.number().min(0).default(0),
  taxaMarketplace: z.number().min(0).max(100).default(0),
  taxaCartao: z.number().min(0).max(100).default(0),
  impostos: z.number().min(0).max(100).default(0),
  taxasAdicionais: z.number().min(0).max(100).default(0),
  margemLucro: z.number().min(0).max(100).default(0),
  custosFixos: z.array(custoFixoSchema).default([]),
});

export type UpdateConfigPrecificacaoInput = z.infer<typeof updateConfigPrecificacaoSchema>;
