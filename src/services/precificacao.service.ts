import prisma from '../utils/prisma.js';
import type { UpdateConfigPrecificacaoInput } from '../schemas/precificacao.schema.js';
import { ensureUserDefaults } from './user-setup.service.js';

export class PrecificacaoService {
  async getConfig(userId: string) {
    await ensureUserDefaults(userId);

    const config = await prisma.configPrecificacao.findUnique({
      where: { userId },
      include: { custosFixos: true },
    });

    if (!config) {
      throw new Error('Configuração não encontrada');
    }

    return formatConfig(config);
  }

  async updateConfig(userId: string, data: UpdateConfigPrecificacaoInput) {
    await ensureUserDefaults(userId);

    const config = await prisma.configPrecificacao.findUnique({ where: { userId } });
    if (!config) {
      throw new Error('Configuração não encontrada');
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.custoFixoConfig.deleteMany({ where: { configId: config.id } });

      return tx.configPrecificacao.update({
        where: { id: config.id },
        data: {
          salarioMensal: data.salarioMensal,
          horasSemanais: data.horasSemanais,
          semanasMes: data.semanasMes,
          diasTrabalhados: data.diasTrabalhados,
          horasDia: data.horasDia,
          taxaMarketplace: data.taxaMarketplace,
          taxaCartao: data.taxaCartao,
          impostos: data.impostos,
          taxasAdicionais: data.taxasAdicionais,
          custosFixos: {
            create: data.custosFixos.map((c) => ({
              nome: c.nome,
              valor: c.valor,
            })),
          },
        },
        include: { custosFixos: true },
      });
    });

    return formatConfig(result);
  }
}

function formatConfig(config: Record<string, unknown>) {
  const custosFixos = (config.custosFixos as Array<Record<string, unknown>>) ?? [];
  return {
    id: config.id,
    salarioMensal: Number(config.salarioMensal),
    horasSemanais: Number(config.horasSemanais),
    semanasMes: Number(config.semanasMes),
    diasTrabalhados: Number(config.diasTrabalhados),
    horasDia: Number(config.horasDia),
    taxaMarketplace: Number(config.taxaMarketplace),
    taxaCartao: Number(config.taxaCartao),
    impostos: Number(config.impostos),
    taxasAdicionais: Number(config.taxasAdicionais),
    custosFixos: custosFixos.map((c) => ({
      id: c.id,
      nome: c.nome,
      valor: Number(c.valor),
    })),
  };
}

export const precificacaoService = new PrecificacaoService();
