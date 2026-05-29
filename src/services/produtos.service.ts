import prisma from '../utils/prisma.js';
import { NotFoundError, AppError } from '../utils/errors.js';
import { CreateProdutoInput, UpdateProdutoInput } from '../schemas/produto.schema.js';
import { buildOrderBy, ListFilters, parseSortOrder } from '../utils/sort.js';

function produtoOrderBy(sortBy?: string, sortOrder?: 'asc' | 'desc') {
  const order = parseSortOrder(sortOrder);
  const allowed: Record<string, Record<string, 'asc' | 'desc'>> = {
    nome: { nome: order },
    categoria: { categoria: order },
    preco: { preco: order },
    status: { status: order },
    createdAt: { createdAt: order },
  };
  return buildOrderBy(sortBy, sortOrder, allowed, { createdAt: 'desc' });
}

export class ProdutosService {
  async findAll(userId: string, filters: ListFilters & { status?: string }) {
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { userId };

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
        orderBy: produtoOrderBy(filters.sortBy, filters.sortOrder),
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
        margemLucro: Number(p.margemLucro),
        preco: Number(p.preco),
        status: p.status,
      })),
      meta: { page, limit, total },
    };
  }

  async findById(userId: string, id: string) {
    const produto = await prisma.produto.findFirst({
      where: { id, userId },
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
      margemLucro: Number(produto.margemLucro),
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

  async create(userId: string, data: CreateProdutoInput) {
    const materiais = data.materiais ?? [];

    let materiaisData: { materiaPrimaId: string; quantidade: number; custoUnitario: number; subtotal: number }[] = [];

    if (materiais.length > 0) {
      const mpIds = materiais.map((m) => m.materiaPrimaId);
      const mps = await prisma.materiaPrima.findMany({ where: { id: { in: mpIds }, userId } });

      if (mps.length !== mpIds.length) {
        throw new AppError('Uma ou mais mat├®rias-primas n├úo encontradas', 400, 'INVALID_MATERIAIS');
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
        userId,
        nome: data.nome,
        categoria: data.categoria,
        descricao: data.descricao,
        tempoProducao: data.tempoProducao,
        margemLucro: data.margemLucro,
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

    return this.findById(userId, produto.id);
  }

  async update(userId: string, id: string, data: UpdateProdutoInput) {
    await this.findById(userId, id);

    const updateData: Record<string, unknown> = {};
    if (data.nome !== undefined) updateData.nome = data.nome;
    if (data.categoria !== undefined) updateData.categoria = data.categoria;
    if (data.descricao !== undefined) updateData.descricao = data.descricao;
    if (data.tempoProducao !== undefined) updateData.tempoProducao = data.tempoProducao;
    if (data.margemLucro !== undefined) updateData.margemLucro = data.margemLucro;
    if (data.preco !== undefined) updateData.preco = data.preco;
    if (data.status !== undefined) updateData.status = data.status;

    if (data.materiais !== undefined) {
      const materiais = data.materiais;
      const mpIds = materiais.map((m) => m.materiaPrimaId);
      const mps = await prisma.materiaPrima.findMany({ where: { id: { in: mpIds }, userId } });

      if (mps.length !== mpIds.length) {
        throw new AppError('Uma ou mais mat├®rias-primas n├úo encontradas', 400, 'INVALID_MATERIAIS');
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

    await prisma.produto.update({
      where: { id },
      data: updateData,
    });

    return this.findById(userId, id);
  }

  async delete(userId: string, id: string) {
    await this.findById(userId, id);
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
