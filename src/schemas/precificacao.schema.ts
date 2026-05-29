import { z } from 'zod';

const custoFixoSchema = z.object({
  nome: z.string().min(1, 'Nome do custo é obrigatório'),
  valor: z.number().min(0, 'Valor deve ser >= 0'),
});

export const updateConfigPrecificacaoSchema = z.object({
  salarioMensal: z.number().min(0).default(0),
  horasSemanais: z.number().min(1).max(168).default(40),
  semanasMes: z.number().min(1).max(5).default(4),
  diasTrabalhados: z.number().int().min(1).max(31).default(22),
  horasDia: z.number().min(1).max(24).default(8),
  taxaMarketplace: z.number().min(0).max(100).default(0),
  taxaCartao: z.number().min(0).max(100).default(0),
  impostos: z.number().min(0).max(100).default(0),
  taxasAdicionais: z.number().min(0).max(100).default(0),
  custosFixos: z.array(custoFixoSchema).default([]),
});

export type UpdateConfigPrecificacaoInput = z.infer<typeof updateConfigPrecificacaoSchema>;
