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
  async findAll(filters: { search?: string; page?: number; limit?: number }) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

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

  async findById(id: string) {
    const item = await prisma.materiaPrima.findUnique({ where: { id } });

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

  async create(data: CreateMateriaPrimaInput) {
    const item = await prisma.materiaPrima.create({ data });

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

  async entrada(data: EntradaEstoqueInput) {
    const item = await prisma.materiaPrima.findUnique({
      where: { id: data.materiaPrimaId },
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

  async saida(data: SaidaEstoqueInput) {
    const item = await prisma.materiaPrima.findUnique({
      where: { id: data.materiaPrimaId },
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

  async update(id: string, data: UpdateEstoqueInput) {
    const existing = await prisma.materiaPrima.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundError('Matéria-prima');
    }

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

  async delete(id: string) {
    const existing = await prisma.materiaPrima.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundError('Matéria-prima');
    }

    const usoEmProduto = await prisma.materialProduto.count({
      where: { materiaPrimaId: id },
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
        where: { materiaPrimaId: id },
        data: { materiaPrimaId: null },
      }),
      prisma.materiaPrima.delete({ where: { id } }),
    ]);
  }
}

export const estoqueService = new EstoqueService();
