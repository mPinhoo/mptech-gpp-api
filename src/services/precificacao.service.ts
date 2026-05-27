import prisma from '../utils/prisma.js';
import { NotFoundError } from '../utils/errors.js';
import type {
  CreatePrecificacaoInput,
  UpdatePrecificacaoInput,
  CalcularPrecificacaoInput,
} from '../schemas/precificacao.schema.js';

interface CalculoResult {
  custoMateriais: number;
  custoMaoDeObra: number;
  totalCustosFixos: number;
  totalExtras: number;
  totalTaxas: number;
  subtotal: number;
  lucroValor: number;
  precoFinal: number;
  precoUnitario: number;
  margemEstimada: number;
}

export class PrecificacaoService {
  calcular(data: CalcularPrecificacaoInput): CalculoResult {
    const custoMateriais = (data.materiais ?? []).reduce(
      (sum, m) => sum + m.custoUnitario * m.quantidade,
      0
    );
    const custoMaoDeObra = (data.tempoProducao ?? 0) * (data.valorHora ?? 0);
    const totalCustosFixos = (data.custosFixos ?? []).reduce(
      (sum, c) => sum + c.valor,
      0
    );
    const totalExtras = (data.extras ?? []).reduce(
      (sum, e) => sum + e.valor,
      0
    );

    const subtotalCustos = custoMateriais + custoMaoDeObra + totalCustosFixos + totalExtras;

    const percentualTaxas =
      (data.taxaMarketplace ?? 0) +
      (data.taxaCartao ?? 0) +
      (data.impostos ?? 0) +
      (data.taxasAdicionais ?? 0);

    const divisorTaxas = 1 - percentualTaxas / 100;
    const custoComTaxas = divisorTaxas > 0 ? subtotalCustos / divisorTaxas : subtotalCustos;
    const totalTaxas = custoComTaxas - subtotalCustos;

    const margemLucro = data.margemLucro ?? 0;
    const divisorLucro = 1 - margemLucro / 100;
    const precoComLucro = divisorLucro > 0 ? custoComTaxas / divisorLucro : custoComTaxas;
    const lucroValor = precoComLucro - custoComTaxas;

    const quantidade = data.quantidade ?? 1;
    const precoUnitario = precoComLucro;
    const precoFinal = precoUnitario * quantidade;

    const margemEstimada = precoFinal > 0
      ? ((precoFinal - subtotalCustos - totalTaxas) / precoFinal) * 100
      : 0;

    return {
      custoMateriais: round2(custoMateriais),
      custoMaoDeObra: round2(custoMaoDeObra),
      totalCustosFixos: round2(totalCustosFixos),
      totalExtras: round2(totalExtras),
      totalTaxas: round2(totalTaxas),
      subtotal: round2(subtotalCustos),
      lucroValor: round2(lucroValor),
      precoFinal: round2(precoFinal),
      precoUnitario: round2(precoUnitario),
      margemEstimada: round2(margemEstimada),
    };
  }

  async findAll(filters: {
    search?: string;
    clienteId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.clienteId) {
      where.clienteId = filters.clienteId;
    }

    if (filters.search) {
      where.OR = [
        { nome: { contains: filters.search, mode: 'insensitive' } },
        { descricao: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.precificacao.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          cliente: { select: { id: true, nome: true } },
        },
      }),
      prisma.precificacao.count({ where }),
    ]);

    return {
      data: items.map(formatPrecificacao),
      meta: { page, limit, total },
    };
  }

  async findById(id: string) {
    const item = await prisma.precificacao.findUnique({
      where: { id },
      include: {
        cliente: { select: { id: true, nome: true } },
        materiais: true,
        custosFixos: true,
        extras: true,
      },
    });

    if (!item) {
      throw new NotFoundError('Precificação');
    }

    return formatPrecificacaoDetalhada(item);
  }

  async create(data: CreatePrecificacaoInput) {
    const calculo = this.calcular(data);

    const result = await prisma.$transaction(async (tx) => {
      const prec = await tx.precificacao.create({
        data: {
          nome: data.nome,
          categoria: data.categoria,
          descricao: data.descricao,
          clienteId: data.clienteId || null,
          observacoes: data.observacoes,
          tempoProducao: data.tempoProducao,
          valorHora: data.valorHora,
          taxaMarketplace: data.taxaMarketplace,
          taxaCartao: data.taxaCartao,
          impostos: data.impostos,
          taxasAdicionais: data.taxasAdicionais,
          margemLucro: data.margemLucro,
          quantidade: data.quantidade,
          status: data.status ?? 'RASCUNHO',
          custoMateriais: calculo.custoMateriais,
          custoMaoDeObra: calculo.custoMaoDeObra,
          totalCustosFixos: calculo.totalCustosFixos,
          totalExtras: calculo.totalExtras,
          totalTaxas: calculo.totalTaxas,
          subtotal: calculo.subtotal,
          lucroValor: calculo.lucroValor,
          precoFinal: calculo.precoFinal,
          precoUnitario: calculo.precoUnitario,
          materiais: {
            create: (data.materiais ?? []).map((m) => ({
              nome: m.nome,
              custoUnitario: m.custoUnitario,
              quantidade: m.quantidade,
              subtotal: round2(m.custoUnitario * m.quantidade),
            })),
          },
          custosFixos: {
            create: (data.custosFixos ?? []).map((c) => ({
              nome: c.nome,
              valor: c.valor,
            })),
          },
          extras: {
            create: (data.extras ?? []).map((e) => ({
              nome: e.nome,
              valor: e.valor,
            })),
          },
        },
        include: {
          cliente: { select: { id: true, nome: true } },
          materiais: true,
          custosFixos: true,
          extras: true,
        },
      });

      return prec;
    });

    return formatPrecificacaoDetalhada(result);
  }

  async update(id: string, data: UpdatePrecificacaoInput) {
    await this.findById(id);

    const existing = await prisma.precificacao.findUnique({
      where: { id },
      include: { materiais: true, custosFixos: true, extras: true },
    });

    const mergedData = {
      tempoProducao: data.tempoProducao ?? Number(existing!.tempoProducao),
      valorHora: data.valorHora ?? Number(existing!.valorHora),
      taxaMarketplace: data.taxaMarketplace ?? Number(existing!.taxaMarketplace),
      taxaCartao: data.taxaCartao ?? Number(existing!.taxaCartao),
      impostos: data.impostos ?? Number(existing!.impostos),
      taxasAdicionais: data.taxasAdicionais ?? Number(existing!.taxasAdicionais),
      margemLucro: data.margemLucro ?? Number(existing!.margemLucro),
      quantidade: data.quantidade ?? existing!.quantidade,
      materiais: data.materiais ?? existing!.materiais.map((m) => ({
        nome: m.nome,
        custoUnitario: Number(m.custoUnitario),
        quantidade: Number(m.quantidade),
      })),
      custosFixos: data.custosFixos ?? existing!.custosFixos.map((c) => ({
        nome: c.nome,
        valor: Number(c.valor),
      })),
      extras: data.extras ?? existing!.extras.map((e) => ({
        nome: e.nome,
        valor: Number(e.valor),
      })),
    };

    const calculo = this.calcular(mergedData);

    const result = await prisma.$transaction(async (tx) => {
      if (data.materiais !== undefined) {
        await tx.materialPrecificacao.deleteMany({ where: { precificacaoId: id } });
      }
      if (data.custosFixos !== undefined) {
        await tx.custoFixoPrecificacao.deleteMany({ where: { precificacaoId: id } });
      }
      if (data.extras !== undefined) {
        await tx.extraPrecificacao.deleteMany({ where: { precificacaoId: id } });
      }

      const updateData: Record<string, unknown> = {
        custoMateriais: calculo.custoMateriais,
        custoMaoDeObra: calculo.custoMaoDeObra,
        totalCustosFixos: calculo.totalCustosFixos,
        totalExtras: calculo.totalExtras,
        totalTaxas: calculo.totalTaxas,
        subtotal: calculo.subtotal,
        lucroValor: calculo.lucroValor,
        precoFinal: calculo.precoFinal,
        precoUnitario: calculo.precoUnitario,
      };

      if (data.nome !== undefined) updateData.nome = data.nome;
      if (data.categoria !== undefined) updateData.categoria = data.categoria;
      if (data.descricao !== undefined) updateData.descricao = data.descricao;
      if (data.clienteId !== undefined) updateData.clienteId = data.clienteId || null;
      if (data.observacoes !== undefined) updateData.observacoes = data.observacoes;
      if (data.tempoProducao !== undefined) updateData.tempoProducao = data.tempoProducao;
      if (data.valorHora !== undefined) updateData.valorHora = data.valorHora;
      if (data.taxaMarketplace !== undefined) updateData.taxaMarketplace = data.taxaMarketplace;
      if (data.taxaCartao !== undefined) updateData.taxaCartao = data.taxaCartao;
      if (data.impostos !== undefined) updateData.impostos = data.impostos;
      if (data.taxasAdicionais !== undefined) updateData.taxasAdicionais = data.taxasAdicionais;
      if (data.margemLucro !== undefined) updateData.margemLucro = data.margemLucro;
      if (data.quantidade !== undefined) updateData.quantidade = data.quantidade;
      if (data.status !== undefined) updateData.status = data.status;

      if (data.materiais !== undefined) {
        updateData.materiais = {
          create: data.materiais.map((m) => ({
            nome: m.nome,
            custoUnitario: m.custoUnitario,
            quantidade: m.quantidade,
            subtotal: round2(m.custoUnitario * m.quantidade),
          })),
        };
      }
      if (data.custosFixos !== undefined) {
        updateData.custosFixos = {
          create: data.custosFixos.map((c) => ({
            nome: c.nome,
            valor: c.valor,
          })),
        };
      }
      if (data.extras !== undefined) {
        updateData.extras = {
          create: data.extras.map((e) => ({
            nome: e.nome,
            valor: e.valor,
          })),
        };
      }

      return tx.precificacao.update({
        where: { id },
        data: updateData,
        include: {
          cliente: { select: { id: true, nome: true } },
          materiais: true,
          custosFixos: true,
          extras: true,
        },
      });
    });

    return formatPrecificacaoDetalhada(result);
  }

  async duplicate(id: string) {
    const original = await prisma.precificacao.findUnique({
      where: { id },
      include: { materiais: true, custosFixos: true, extras: true },
    });

    if (!original) {
      throw new NotFoundError('Precificação');
    }

    const result = await prisma.precificacao.create({
      data: {
        nome: `${original.nome} (cópia)`,
        categoria: original.categoria,
        descricao: original.descricao,
        clienteId: original.clienteId,
        observacoes: original.observacoes,
        tempoProducao: original.tempoProducao,
        valorHora: original.valorHora,
        taxaMarketplace: original.taxaMarketplace,
        taxaCartao: original.taxaCartao,
        impostos: original.impostos,
        taxasAdicionais: original.taxasAdicionais,
        margemLucro: original.margemLucro,
        quantidade: original.quantidade,
        status: 'RASCUNHO',
        custoMateriais: original.custoMateriais,
        custoMaoDeObra: original.custoMaoDeObra,
        totalCustosFixos: original.totalCustosFixos,
        totalExtras: original.totalExtras,
        totalTaxas: original.totalTaxas,
        subtotal: original.subtotal,
        lucroValor: original.lucroValor,
        precoFinal: original.precoFinal,
        precoUnitario: original.precoUnitario,
        materiais: {
          create: original.materiais.map((m) => ({
            nome: m.nome,
            custoUnitario: m.custoUnitario,
            quantidade: m.quantidade,
            subtotal: m.subtotal,
          })),
        },
        custosFixos: {
          create: original.custosFixos.map((c) => ({
            nome: c.nome,
            valor: c.valor,
          })),
        },
        extras: {
          create: original.extras.map((e) => ({
            nome: e.nome,
            valor: e.valor,
          })),
        },
      },
      include: {
        cliente: { select: { id: true, nome: true } },
        materiais: true,
        custosFixos: true,
        extras: true,
      },
    });

    return formatPrecificacaoDetalhada(result);
  }

  async delete(id: string) {
    await this.findById(id);
    await prisma.precificacao.delete({ where: { id } });
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatPrecificacao(p: Record<string, unknown>) {
  return {
    id: p.id,
    nome: p.nome,
    categoria: p.categoria,
    descricao: p.descricao,
    clienteId: p.clienteId,
    cliente: p.cliente,
    observacoes: p.observacoes,
    quantidade: p.quantidade,
    precoFinal: Number(p.precoFinal),
    precoUnitario: Number(p.precoUnitario),
    status: p.status,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

function formatPrecificacaoDetalhada(p: Record<string, unknown>) {
  const base = formatPrecificacao(p);
  const materiais = (p.materiais as Array<Record<string, unknown>>) ?? [];
  const custosFixos = (p.custosFixos as Array<Record<string, unknown>>) ?? [];
  const extras = (p.extras as Array<Record<string, unknown>>) ?? [];

  return {
    ...base,
    tempoProducao: Number(p.tempoProducao),
    valorHora: Number(p.valorHora),
    taxaMarketplace: Number(p.taxaMarketplace),
    taxaCartao: Number(p.taxaCartao),
    impostos: Number(p.impostos),
    taxasAdicionais: Number(p.taxasAdicionais),
    margemLucro: Number(p.margemLucro),
    custoMateriais: Number(p.custoMateriais),
    custoMaoDeObra: Number(p.custoMaoDeObra),
    totalCustosFixos: Number(p.totalCustosFixos),
    totalExtras: Number(p.totalExtras),
    totalTaxas: Number(p.totalTaxas),
    subtotal: Number(p.subtotal),
    lucroValor: Number(p.lucroValor),
    materiais: materiais.map((m) => ({
      id: m.id,
      nome: m.nome,
      custoUnitario: Number(m.custoUnitario),
      quantidade: Number(m.quantidade),
      subtotal: Number(m.subtotal),
    })),
    custosFixos: custosFixos.map((c) => ({
      id: c.id,
      nome: c.nome,
      valor: Number(c.valor),
    })),
    extras: extras.map((e) => ({
      id: e.id,
      nome: e.nome,
      valor: Number(e.valor),
    })),
  };
}

export const precificacaoService = new PrecificacaoService();
