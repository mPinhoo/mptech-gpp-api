import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../utils/prisma.js';
import { NotFoundError, AppError } from '../utils/errors.js';
import {
  CreateMateriaPrimaInput,
  EntradaEstoqueInput,
  SaidaEstoqueInput,
  UpdateEstoqueInput,
} from '../schemas/estoque.schema.js';

function calcularStatus(quantidade: number, quantidadeMinima: number): string {
  if (quantidade <= 0) return 'Crítico';
  if (quantidade <= quantidadeMinima) return 'Baixo';
  return 'Normal';
}

export class EstoqueService {
  async findAll(userId: string, filters: { search?: string; page?: number; limit?: number }) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { userId };

    if (filters.search) {
      where.nome = { contains: filters.search, mode: 'insensitive' };
    }

    const [itens, total] = await Promise.all([
      prisma.materiaPrima.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.materiaPrima.count({ where }),
    ]);

    return {
      data: itens.map((item) => ({
        id: item.id,
        nome: item.nome,
        unidade: item.unidade,
        precoCusto: Number(item.precoCusto),
        quantidade: item.quantidade,
        minimo: item.quantidadeMinima,
        status: calcularStatus(item.quantidade, item.quantidadeMinima),
      })),
      meta: { page, limit, total },
    };
  }

  async findById(userId: string, id: string) {
    const item = await prisma.materiaPrima.findFirst({ where: { id, userId } });

    if (!item) {
      throw new NotFoundError('Matéria-prima');
    }

    return {
      id: item.id,
      nome: item.nome,
      unidade: item.unidade,
      precoCusto: Number(item.precoCusto),
      quantidade: item.quantidade,
      minimo: item.quantidadeMinima,
      status: calcularStatus(item.quantidade, item.quantidadeMinima),
    };
  }

  async create(userId: string, data: CreateMateriaPrimaInput) {
    const item = await prisma.materiaPrima.create({
      data: { ...data, userId },
    });

    return {
      id: item.id,
      nome: item.nome,
      unidade: item.unidade,
      precoCusto: Number(item.precoCusto),
      quantidade: item.quantidade,
      minimo: item.quantidadeMinima,
      status: calcularStatus(item.quantidade, item.quantidadeMinima),
    };
  }

  async entrada(userId: string, data: EntradaEstoqueInput) {
    const item = await prisma.materiaPrima.findFirst({
      where: { id: data.materiaPrimaId, userId },
    });

    if (!item) {
      throw new NotFoundError('Matéria-prima');
    }

    const custoEntrada = Number(item.precoCusto) * data.quantidade;

    const [updated] = await prisma.$transaction([
      prisma.materiaPrima.update({
        where: { id: data.materiaPrimaId },
        data: { quantidade: { increment: data.quantidade } },
      }),
      prisma.despesa.create({
        data: {
          userId,
          descricao: `Entrada estoque: ${item.nome} (x${data.quantidade})`,
          valor: new Decimal(custoEntrada),
          materiaPrimaId: data.materiaPrimaId,
        },
      }),
    ]);

    return {
      id: updated.id,
      nome: updated.nome,
      unidade: updated.unidade,
      precoCusto: Number(updated.precoCusto),
      quantidade: updated.quantidade,
      minimo: updated.quantidadeMinima,
      status: calcularStatus(updated.quantidade, updated.quantidadeMinima),
    };
  }

  async saida(userId: string, data: SaidaEstoqueInput) {
    const item = await prisma.materiaPrima.findFirst({
      where: { id: data.materiaPrimaId, userId },
    });

    if (!item) {
      throw new NotFoundError('Matéria-prima');
    }

    if (item.quantidade < data.quantidade) {
      throw new AppError('Quantidade insuficiente em estoque', 400, 'INSUFFICIENT_STOCK');
    }

    const updated = await prisma.materiaPrima.update({
      where: { id: data.materiaPrimaId },
      data: { quantidade: { decrement: data.quantidade } },
    });

    return {
      id: updated.id,
      nome: updated.nome,
      unidade: updated.unidade,
      precoCusto: Number(updated.precoCusto),
      quantidade: updated.quantidade,
      minimo: updated.quantidadeMinima,
      status: calcularStatus(updated.quantidade, updated.quantidadeMinima),
    };
  }

  async update(userId: string, id: string, data: UpdateEstoqueInput) {
    await this.findById(userId, id);

    const updated = await prisma.materiaPrima.update({
      where: { id },
      data,
    });

    return {
      id: updated.id,
      nome: updated.nome,
      unidade: updated.unidade,
      precoCusto: Number(updated.precoCusto),
      quantidade: updated.quantidade,
      minimo: updated.quantidadeMinima,
      status: calcularStatus(updated.quantidade, updated.quantidadeMinima),
    };
  }

  async delete(userId: string, id: string) {
    await this.findById(userId, id);

    const usoEmProduto = await prisma.materialProduto.count({
      where: { materiaPrimaId: id, produto: { userId } },
    });

    if (usoEmProduto > 0) {
      throw new AppError(
        'Matéria-prima em uso em produtos e não pode ser excluída',
        400,
        'MATERIA_EM_USO'
      );
    }

    await prisma.$transaction([
      prisma.despesa.updateMany({
        where: { materiaPrimaId: id, userId },
        data: { materiaPrimaId: null },
      }),
      prisma.materiaPrima.delete({ where: { id } }),
    ]);
  }
}

export const estoqueService = new EstoqueService();
