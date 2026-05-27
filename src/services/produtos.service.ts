import prisma from '../utils/prisma.js';
import { NotFoundError } from '../utils/errors.js';
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
        preco: Number(p.preco),
        status: p.status,
      })),
      meta: { page, limit, total },
    };
  }

  async findById(id: string) {
    const produto = await prisma.produto.findUnique({ where: { id } });

    if (!produto) {
      throw new NotFoundError('Produto');
    }

    return {
      id: produto.id,
      nome: produto.nome,
      categoria: produto.categoria,
      preco: Number(produto.preco),
      status: produto.status,
    };
  }

  async create(data: CreateProdutoInput) {
    const produto = await prisma.produto.create({ data });

    return {
      id: produto.id,
      nome: produto.nome,
      categoria: produto.categoria,
      preco: Number(produto.preco),
      status: produto.status,
    };
  }

  async update(id: string, data: UpdateProdutoInput) {
    await this.findById(id);

    const produto = await prisma.produto.update({
      where: { id },
      data,
    });

    return {
      id: produto.id,
      nome: produto.nome,
      categoria: produto.categoria,
      preco: Number(produto.preco),
      status: produto.status,
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

export const produtosService = new ProdutosService();
