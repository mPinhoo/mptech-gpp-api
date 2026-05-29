import prisma from '../utils/prisma.js';
import { NotFoundError, AppError } from '../utils/errors.js';
import { CreateProdutoInput, UpdateProdutoInput } from '../schemas/produto.schema.js';

export class ProdutosService {
  async findAll(filters: { status?: string; search?: string; page?: number; limit?: number }) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.search) {
      where.OR = [
        { nome: { contains: filters.search, mode: 'insensitive' } },
        { categoria: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [produtos, total] = await Promise.all([
      prisma.produto.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.produto.count({ where }),
    ]);

    return {
      data: produtos.map((p) => ({
        id: p.id,
        nome: p.nome,
        categoria: p.categoria,
        descricao: p.descricao,
        tempoProducao: Number(p.tempoProducao),
        preco: Number(p.preco),
        status: p.status,
      })),
      meta: { page, limit, total },
    };
  }

  async findById(id: string) {
    const produto = await prisma.produto.findUnique({
      where: { id },
      include: {
        materiais: {
          include: { materiaPrima: { select: { id: true, nome: true, unidade: true, precoCusto: true } } },
        },
      },
    });

    if (!produto) {
      throw new NotFoundError('Produto');
    }

    return {
      id: produto.id,
      nome: produto.nome,
      categoria: produto.categoria,
      descricao: produto.descricao,
      tempoProducao: Number(produto.tempoProducao),
      preco: Number(produto.preco),
      status: produto.status,
      materiais: produto.materiais.map((m) => ({
        id: m.id,
        materiaPrimaId: m.materiaPrimaId,
        nome: m.materiaPrima.nome,
        unidade: m.materiaPrima.unidade,
        quantidade: Number(m.quantidade),
        custoUnitario: Number(m.custoUnitario),
        subtotal: Number(m.subtotal),
      })),
    };
  }

  async create(data: CreateProdutoInput) {
    const materiais = data.materiais ?? [];

    let materiaisData: { materiaPrimaId: string; quantidade: number; custoUnitario: number; subtotal: number }[] = [];

    if (materiais.length > 0) {
      const mpIds = materiais.map((m) => m.materiaPrimaId);
      const mps = await prisma.materiaPrima.findMany({ where: { id: { in: mpIds } } });

      if (mps.length !== mpIds.length) {
        throw new AppError('Uma ou mais matérias-primas não encontradas', 400, 'INVALID_MATERIAIS');
      }

      const mpMap = new Map(mps.map((mp) => [mp.id, mp]));
      materiaisData = materiais.map((m) => {
        const mp = mpMap.get(m.materiaPrimaId)!;
        const custoUnitario = Number(mp.precoCusto);
        return {
          materiaPrimaId: m.materiaPrimaId,
          quantidade: m.quantidade,
          custoUnitario,
          subtotal: round2(custoUnitario * m.quantidade),
        };
      });
    }

    const produto = await prisma.produto.create({
      data: {
        nome: data.nome,
        categoria: data.categoria,
        descricao: data.descricao,
        tempoProducao: data.tempoProducao,
        preco: data.preco,
        status: data.status,
        materiais: {
          create: materiaisData,
        },
      },
      include: {
        materiais: {
          include: { materiaPrima: { select: { id: true, nome: true, unidade: true, precoCusto: true } } },
        },
      },
    });

    return {
      id: produto.id,
      nome: produto.nome,
      categoria: produto.categoria,
      descricao: produto.descricao,
      tempoProducao: Number(produto.tempoProducao),
      preco: Number(produto.preco),
      status: produto.status,
      materiais: produto.materiais.map((m) => ({
        id: m.id,
        materiaPrimaId: m.materiaPrimaId,
        nome: m.materiaPrima.nome,
        unidade: m.materiaPrima.unidade,
        quantidade: Number(m.quantidade),
        custoUnitario: Number(m.custoUnitario),
        subtotal: Number(m.subtotal),
      })),
    };
  }

  async update(id: string, data: UpdateProdutoInput) {
    await this.findById(id);

    const updateData: Record<string, unknown> = {};
    if (data.nome !== undefined) updateData.nome = data.nome;
    if (data.categoria !== undefined) updateData.categoria = data.categoria;
    if (data.descricao !== undefined) updateData.descricao = data.descricao;
    if (data.tempoProducao !== undefined) updateData.tempoProducao = data.tempoProducao;
    if (data.preco !== undefined) updateData.preco = data.preco;
    if (data.status !== undefined) updateData.status = data.status;

    if (data.materiais !== undefined) {
      const materiais = data.materiais;
      const mpIds = materiais.map((m) => m.materiaPrimaId);
      const mps = await prisma.materiaPrima.findMany({ where: { id: { in: mpIds } } });

      if (mps.length !== mpIds.length) {
        throw new AppError('Uma ou mais matérias-primas não encontradas', 400, 'INVALID_MATERIAIS');
      }

      const mpMap = new Map(mps.map((mp) => [mp.id, mp]));

      await prisma.materialProduto.deleteMany({ where: { produtoId: id } });

      updateData.materiais = {
        create: materiais.map((m) => {
          const mp = mpMap.get(m.materiaPrimaId)!;
          const custoUnitario = Number(mp.precoCusto);
          return {
            materiaPrimaId: m.materiaPrimaId,
            quantidade: m.quantidade,
            custoUnitario,
            subtotal: round2(custoUnitario * m.quantidade),
          };
        }),
      };
    }

    const produto = await prisma.produto.update({
      where: { id },
      data: updateData,
      include: {
        materiais: {
          include: { materiaPrima: { select: { id: true, nome: true, unidade: true, precoCusto: true } } },
        },
      },
    });

    return {
      id: produto.id,
      nome: produto.nome,
      categoria: produto.categoria,
      descricao: produto.descricao,
      tempoProducao: Number(produto.tempoProducao),
      preco: Number(produto.preco),
      status: produto.status,
      materiais: produto.materiais.map((m) => ({
        id: m.id,
        materiaPrimaId: m.materiaPrimaId,
        nome: m.materiaPrima.nome,
        unidade: m.materiaPrima.unidade,
        quantidade: Number(m.quantidade),
        custoUnitario: Number(m.custoUnitario),
        subtotal: Number(m.subtotal),
      })),
    };
  }

  async delete(id: string) {
    await this.findById(id);
    await prisma.produto.update({
      where: { id },
      data: { status: 'INATIVO' },
    });
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export const produtosService = new ProdutosService();
