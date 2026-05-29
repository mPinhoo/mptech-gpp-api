import prisma from '../utils/prisma.js';
import type { UpdateConfigPrecificacaoInput } from '../schemas/precificacao.schema.js';

export class PrecificacaoService {
  async getConfig() {
    let config = await prisma.configPrecificacao.findFirst({
      include: { custosFixos: true },
    });

    if (!config) {
      config = await prisma.configPrecificacao.create({
        data: {},
        include: { custosFixos: true },
      });
    }

    return formatConfig(config);
  }

  async updateConfig(data: UpdateConfigPrecificacaoInput) {
    let config = await prisma.configPrecificacao.findFirst();

    if (!config) {
      config = await prisma.configPrecificacao.create({ data: {} });
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.custoFixoConfig.deleteMany({ where: { configId: config!.id } });

      return tx.configPrecificacao.update({
        where: { id: config!.id },
        data: {
          tempoProducao: data.tempoProducao,
          valorHora: data.valorHora,
          taxaMarketplace: data.taxaMarketplace,
          taxaCartao: data.taxaCartao,
          impostos: data.impostos,
          taxasAdicionais: data.taxasAdicionais,
          margemLucro: data.margemLucro,
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
    tempoProducao: Number(config.tempoProducao),
    valorHora: Number(config.valorHora),
    taxaMarketplace: Number(config.taxaMarketplace),
    taxaCartao: Number(config.taxaCartao),
    impostos: Number(config.impostos),
    taxasAdicionais: Number(config.taxasAdicionais),
    margemLucro: Number(config.margemLucro),
    custosFixos: custosFixos.map((c) => ({
      id: c.id,
      nome: c.nome,
      valor: Number(c.valor),
    })),
  };
}

export const precificacaoService = new PrecificacaoService();
