import prisma from '../utils/prisma.js';
import { NotFoundError, AppError } from '../utils/errors.js';
import type {
  CreateColunaInput,
  UpdateColunaInput,
  ReorderColunasInput,
} from '../schemas/kanban.schema.js';

const pedidoSelect = {
  id: true,
  numero: true,
  clienteId: true,
  cliente: { select: { id: true, nome: true } },
  dataPedido: true,
  prazoEntrega: true,
  status: true,
  valorTotal: true,
  kanbanColunaId: true,
  itens: {
    select: {
      id: true,
      produto: { select: { nome: true } },
      quantidade: true,
    },
  },
};

export class KanbanService {
  async getColunas() {
    const colunas = await prisma.kanbanColuna.findMany({
      orderBy: { ordem: 'asc' },
      include: {
        pedidos: {
          where: { status: 'APROVADO' },
          select: pedidoSelect,
          orderBy: { updatedAt: 'desc' },
        },
      },
    });

    const semColuna = await prisma.pedido.findMany({
      where: { status: 'APROVADO', kanbanColunaId: null },
      select: pedidoSelect,
      orderBy: { updatedAt: 'desc' },
    });

    return {
      colunas: colunas.map(formatColuna),
      semColuna: semColuna.map(formatPedidoKanban),
    };
  }

  async createColuna(data: CreateColunaInput) {
    const maxOrdem = await prisma.kanbanColuna.aggregate({
      _max: { ordem: true },
    });
    const ordem = (maxOrdem._max.ordem ?? -1) + 1;

    const coluna = await prisma.kanbanColuna.create({
      data: { nome: data.nome, ordem },
      include: {
        pedidos: {
          where: { status: 'APROVADO' },
          select: pedidoSelect,
        },
      },
    });

    return formatColuna(coluna);
  }

  async updateColuna(id: string, data: UpdateColunaInput) {
    const exists = await prisma.kanbanColuna.findUnique({ where: { id } });
    if (!exists) throw new NotFoundError('Coluna');
    if (exists.sistema) throw new AppError('Colunas do sistema não podem ser editadas', 400);

    const coluna = await prisma.kanbanColuna.update({
      where: { id },
      data: { nome: data.nome },
      include: {
        pedidos: {
          where: { status: 'APROVADO' },
          select: pedidoSelect,
        },
      },
    });

    return formatColuna(coluna);
  }

  async reorderColunas(data: ReorderColunasInput) {
    await prisma.$transaction(
      data.colunas.map((c) =>
        prisma.kanbanColuna.update({
          where: { id: c.id },
          data: { ordem: c.ordem },
        })
      )
    );
  }

  async deleteColuna(id: string) {
    const exists = await prisma.kanbanColuna.findUnique({ where: { id } });
    if (!exists) throw new NotFoundError('Coluna');
    if (exists.sistema) throw new AppError('Colunas do sistema não podem ser excluídas', 400);

    await prisma.$transaction([
      prisma.pedido.updateMany({
        where: { kanbanColunaId: id },
        data: { kanbanColunaId: null },
      }),
      prisma.kanbanColuna.delete({ where: { id } }),
    ]);
  }

  async moverPedido(pedidoId: string, kanbanColunaId: string | null) {
    const pedido = await prisma.pedido.findUnique({ where: { id: pedidoId } });
    if (!pedido) throw new NotFoundError('Pedido');

    if (kanbanColunaId) {
      const coluna = await prisma.kanbanColuna.findUnique({
        where: { id: kanbanColunaId },
      });
      if (!coluna) throw new NotFoundError('Coluna');
    }

    const updated = await prisma.pedido.update({
      where: { id: pedidoId },
      data: { kanbanColunaId },
      select: pedidoSelect,
    });

    return formatPedidoKanban(updated);
  }
}

function formatColuna(c: Record<string, unknown>) {
  const pedidos = (c.pedidos as Array<Record<string, unknown>>) ?? [];
  return {
    id: c.id,
    nome: c.nome,
    ordem: c.ordem,
    sistema: c.sistema,
    pedidos: pedidos.map(formatPedidoKanban),
  };
}

function formatPedidoKanban(p: Record<string, unknown>) {
  const itens = (p.itens as Array<Record<string, unknown>>) ?? [];
  return {
    id: p.id,
    numero: p.numero,
    cliente: p.cliente,
    dataPedido: p.dataPedido,
    prazoEntrega: p.prazoEntrega,
    status: p.status,
    valorTotal: Number(p.valorTotal),
    kanbanColunaId: p.kanbanColunaId,
    itens: itens.map((i) => ({
      id: i.id,
      produto: (i.produto as Record<string, unknown>)?.nome,
      quantidade: i.quantidade,
    })),
  };
}

export const kanbanService = new KanbanService();
