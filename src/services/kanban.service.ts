import prisma from '../utils/prisma.js';
import { NotFoundError, AppError } from '../utils/errors.js';
import type {
  CreateColunaInput,
  UpdateColunaInput,
  ReorderColunasInput,
} from '../schemas/kanban.schema.js';
import { ensureUserDefaults } from './user-setup.service.js';
import { calcularAlertaPrazo } from '../utils/prazo-alerta.js';

const COLUNA_FINALIZADO = 'Finalizado';

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
  kanbanColuna: { select: { nome: true } },
  itens: {
    select: {
      id: true,
      produto: { select: { nome: true } },
      quantidade: true,
    },
  },
};

export class KanbanService {
  async getColunas(userId: string) {
    await ensureUserDefaults(userId);

    const colunas = await prisma.kanbanColuna.findMany({
      where: { userId },
      orderBy: { ordem: 'asc' },
      include: {
        pedidos: {
          where: { status: 'APROVADO', userId },
          select: pedidoSelect,
          orderBy: { updatedAt: 'desc' },
        },
      },
    });

    const semColuna = await prisma.pedido.findMany({
      where: { userId, status: 'APROVADO', kanbanColunaId: null },
      select: pedidoSelect,
      orderBy: { updatedAt: 'desc' },
    });

    return {
      colunas: colunas.map(formatColuna),
      semColuna: semColuna.map((p) => formatPedidoKanban(p, null)),
    };
  }

  async createColuna(userId: string, data: CreateColunaInput) {
    const maxOrdem = await prisma.kanbanColuna.aggregate({
      where: { userId },
      _max: { ordem: true },
    });
    const ordem = (maxOrdem._max.ordem ?? -1) + 1;

    const coluna = await prisma.kanbanColuna.create({
      data: { userId, nome: data.nome, ordem },
      include: {
        pedidos: {
          where: { status: 'APROVADO', userId },
          select: pedidoSelect,
        },
      },
    });

    return formatColuna(coluna);
  }

  async updateColuna(userId: string, id: string, data: UpdateColunaInput) {
    const exists = await prisma.kanbanColuna.findFirst({ where: { id, userId } });
    if (!exists) throw new NotFoundError('Coluna');
    if (exists.sistema) throw new AppError('Colunas do sistema não podem ser editadas', 400);

    const coluna = await prisma.kanbanColuna.update({
      where: { id },
      data: { nome: data.nome },
      include: {
        pedidos: {
          where: { status: 'APROVADO', userId },
          select: pedidoSelect,
        },
      },
    });

    return formatColuna(coluna);
  }

  async reorderColunas(userId: string, data: ReorderColunasInput) {
    const ids = data.colunas.map((c) => c.id);
    const colunas = await prisma.kanbanColuna.findMany({
      where: { id: { in: ids }, userId },
    });

    if (colunas.length !== ids.length) {
      throw new NotFoundError('Coluna');
    }

    await prisma.$transaction(
      data.colunas.map((c) =>
        prisma.kanbanColuna.update({
          where: { id: c.id },
          data: { ordem: c.ordem },
        })
      )
    );
  }

  async deleteColuna(userId: string, id: string) {
    const exists = await prisma.kanbanColuna.findFirst({ where: { id, userId } });
    if (!exists) throw new NotFoundError('Coluna');
    if (exists.sistema) throw new AppError('Colunas do sistema não podem ser excluídas', 400);

    await prisma.$transaction([
      prisma.pedido.updateMany({
        where: { kanbanColunaId: id, userId },
        data: { kanbanColunaId: null },
      }),
      prisma.kanbanColuna.delete({ where: { id } }),
    ]);
  }

  async moverPedido(userId: string, pedidoId: string, kanbanColunaId: string | null) {
    const pedido = await prisma.pedido.findFirst({ where: { id: pedidoId, userId } });
    if (!pedido) throw new NotFoundError('Pedido');

    if (kanbanColunaId) {
      const coluna = await prisma.kanbanColuna.findFirst({
        where: { id: kanbanColunaId, userId },
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

  async arquivarPedido(userId: string, pedidoId: string) {
    const pedido = await prisma.pedido.findFirst({
      where: { id: pedidoId, userId },
      include: { kanbanColuna: { select: { nome: true } } },
    });
    if (!pedido) throw new NotFoundError('Pedido');
    if (pedido.kanbanColuna?.nome !== COLUNA_FINALIZADO) {
      throw new AppError('Apenas pedidos na coluna Finalizado podem ser arquivados', 400);
    }

    await prisma.pedido.update({
      where: { id: pedidoId },
      data: { status: 'CONCLUIDO', kanbanColunaId: null, linkToken: null },
    });

    return { message: 'Pedido arquivado' };
  }

  async arquivarTodosColuna(userId: string, colunaId: string) {
    const coluna = await prisma.kanbanColuna.findFirst({ where: { id: colunaId, userId } });
    if (!coluna) throw new NotFoundError('Coluna');
    if (coluna.nome !== COLUNA_FINALIZADO) {
      throw new AppError('Apenas a coluna Finalizado permite arquivar todos', 400);
    }

    const result = await prisma.pedido.updateMany({
      where: { userId, kanbanColunaId: colunaId, status: 'APROVADO' },
      data: { status: 'CONCLUIDO', kanbanColunaId: null, linkToken: null },
    });

    return { arquivados: result.count };
  }
}

function formatColuna(c: Record<string, unknown>) {
  const pedidos = (c.pedidos as Array<Record<string, unknown>>) ?? [];
  const nomeColuna = c.nome as string;
  return {
    id: c.id,
    nome: c.nome,
    ordem: c.ordem,
    sistema: c.sistema,
    pedidos: pedidos.map((pedido) => formatPedidoKanban(pedido, nomeColuna)),
  };
}

function formatPedidoKanban(p: Record<string, unknown>, nomeColuna?: string | null) {
  const itens = (p.itens as Array<Record<string, unknown>>) ?? [];
  const prazoEntrega = p.prazoEntrega as Date;
  const coluna =
    nomeColuna ??
    ((p.kanbanColuna as { nome: string } | null | undefined)?.nome ?? null);

  return {
    id: p.id,
    numero: p.numero,
    cliente: p.cliente,
    dataPedido: p.dataPedido,
    prazoEntrega: p.prazoEntrega,
    status: p.status,
    valorTotal: Number(p.valorTotal),
    kanbanColunaId: p.kanbanColunaId,
    colunaNome: coluna,
    alertaPrazo: calcularAlertaPrazo(prazoEntrega, coluna),
    itens: itens.map((i) => ({
      id: i.id,
      produto: (i.produto as Record<string, unknown>)?.nome,
      quantidade: i.quantidade,
    })),
  };
}

export const kanbanService = new KanbanService();
