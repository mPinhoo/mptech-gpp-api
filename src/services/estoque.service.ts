import prisma from '../utils/prisma.js';
import { NotFoundError, AppError } from '../utils/errors.js';
import { EntradaEstoqueInput, SaidaEstoqueInput, UpdateEstoqueInput } from '../schemas/estoque.schema.js';

function calcularStatus(quantidade: number, quantidadeMinima: number): string {
  if (quantidade <= 0) return 'Crítico';
  if (quantidade <= quantidadeMinima) return 'Baixo';
  return 'Normal';
}

export class EstoqueService {
  async findAll(filters: { search?: string; page?: number; limit?: number }) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (filters.search) {
      where.produto = {
        nome: { contains: filters.search, mode: 'insensitive' },
      };
    }

    const [itens, total] = await Promise.all([
      prisma.estoque.findMany({
        where,
        skip,
        take: limit,
        include: { produto: { select: { nome: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.estoque.count({ where }),
    ]);

    return {
      data: itens.map((item) => ({
        id: item.id,
        produto: item.produto.nome,
        quantidade: item.quantidade,
        minimo: item.quantidadeMinima,
        unidade: item.unidade,
        status: calcularStatus(item.quantidade, item.quantidadeMinima),
      })),
      meta: { page, limit, total },
    };
  }

  async findById(id: string) {
    const item = await prisma.estoque.findUnique({
      where: { id },
      include: { produto: { select: { nome: true } } },
    });

    if (!item) {
      throw new NotFoundError('Item de estoque');
    }

    return {
      id: item.id,
      produtoId: item.produtoId,
      produto: item.produto.nome,
      quantidade: item.quantidade,
      minimo: item.quantidadeMinima,
      unidade: item.unidade,
      status: calcularStatus(item.quantidade, item.quantidadeMinima),
    };
  }

  async entrada(data: EntradaEstoqueInput) {
    const estoque = await prisma.estoque.findUnique({
      where: { produtoId: data.produtoId },
    });

    if (!estoque) {
      throw new NotFoundError('Estoque do produto');
    }

    const updated = await prisma.estoque.update({
      where: { produtoId: data.produtoId },
      data: { quantidade: { increment: data.quantidade } },
      include: { produto: { select: { nome: true } } },
    });

    return {
      id: updated.id,
      produto: updated.produto.nome,
      quantidade: updated.quantidade,
      minimo: updated.quantidadeMinima,
      unidade: updated.unidade,
      status: calcularStatus(updated.quantidade, updated.quantidadeMinima),
    };
  }

  async saida(data: SaidaEstoqueInput) {
    const estoque = await prisma.estoque.findUnique({
      where: { produtoId: data.produtoId },
    });

    if (!estoque) {
      throw new NotFoundError('Estoque do produto');
    }

    if (estoque.quantidade < data.quantidade) {
      throw new AppError('Quantidade insuficiente em estoque', 400, 'INSUFFICIENT_STOCK');
    }

    const updated = await prisma.estoque.update({
      where: { produtoId: data.produtoId },
      data: { quantidade: { decrement: data.quantidade } },
      include: { produto: { select: { nome: true } } },
    });

    return {
      id: updated.id,
      produto: updated.produto.nome,
      quantidade: updated.quantidade,
      minimo: updated.quantidadeMinima,
      unidade: updated.unidade,
      status: calcularStatus(updated.quantidade, updated.quantidadeMinima),
    };
  }

  async update(id: string, data: UpdateEstoqueInput) {
    const item = await prisma.estoque.findUnique({ where: { id } });

    if (!item) {
      throw new NotFoundError('Item de estoque');
    }

    const updated = await prisma.estoque.update({
      where: { id },
      data,
      include: { produto: { select: { nome: true } } },
    });

    return {
      id: updated.id,
      produto: updated.produto.nome,
      quantidade: updated.quantidade,
      minimo: updated.quantidadeMinima,
      unidade: updated.unidade,
      status: calcularStatus(updated.quantidade, updated.quantidadeMinima),
    };
  }
}

export const estoqueService = new EstoqueService();
