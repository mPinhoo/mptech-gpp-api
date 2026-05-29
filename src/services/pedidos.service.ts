import { randomUUID } from 'crypto';
import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../utils/prisma.js';
import { NotFoundError, AppError } from '../utils/errors.js';
import { CreatePedidoInput, UpdatePedidoInput } from '../schemas/pedido.schema.js';
import { buildOrderBy, ListFilters, parseSortOrder } from '../utils/sort.js';
import { findClienteIdsBySimilarName } from '../utils/similarity.js';

function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function pedidoOrderBy(sortBy?: string, sortOrder?: 'asc' | 'desc') {
  const order = parseSortOrder(sortOrder);
  return buildOrderBy(
    sortBy,
    sortOrder,
    {
      numero: { numero: order },
      cliente: { cliente: { nome: order } },
      data: { dataPedido: order },
      valor: { valorTotal: order },
      status: { status: order },
      createdAt: { createdAt: order },
    },
    { createdAt: 'desc' }
  );
}

export class PedidosService {
  async findAll(
    userId: string,
    filters: ListFilters & {
      status?: string;
      numero?: string;
      cliente?: string;
      dataDe?: string;
      dataAte?: string;
    }
  ) {
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { userId };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.numero) {
      where.numero = { contains: filters.numero, mode: 'insensitive' };
    }

    if (filters.cliente) {
      const clienteIds = await findClienteIdsBySimilarName(userId, filters.cliente);
      if (clienteIds.length === 0) {
        return { data: [], meta: { page, limit, total: 0 } };
      }
      where.clienteId = { in: clienteIds };
    }

    if (filters.dataDe || filters.dataAte) {
      const dataPedido: Record<string, Date> = {};
      if (filters.dataDe) {
        const start = new Date(filters.dataDe);
        start.setHours(0, 0, 0, 0);
        dataPedido.gte = start;
      }
      if (filters.dataAte) {
        const end = new Date(filters.dataAte);
        end.setHours(23, 59, 59, 999);
        dataPedido.lte = end;
      }
      where.dataPedido = dataPedido;
    }

    if (filters.search) {
      where.OR = [
        { numero: { contains: filters.search, mode: 'insensitive' } },
        { cliente: { nome: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    const [pedidos, total] = await Promise.all([
      prisma.pedido.findMany({
        where,
        skip,
        take: limit,
        include: {
          cliente: { select: { nome: true } },
          kanbanColuna: { select: { nome: true } },
        },
        orderBy: pedidoOrderBy(filters.sortBy, filters.sortOrder),
      }),
      prisma.pedido.count({ where }),
    ]);

    const statusMap: Record<string, string> = {
      PENDENTE: 'Pendente',
      APROVADO: 'Aprovado',
      CONCLUIDO: 'Concluído',
      CANCELADO: 'Cancelado',
    };

    return {
      data: pedidos.map((p) => ({
        id: p.id,
        numero: p.numero,
        cliente: p.cliente.nome,
        data: formatDate(p.dataPedido),
        valor: formatCurrency(Number(p.valorTotal)),
        status: statusMap[p.status] || p.status,
        statusOriginal: p.status,
        kanbanColuna: p.kanbanColuna?.nome || null,
      })),
      meta: { page, limit, total },
    };
  }

  async findById(userId: string, id: string) {
    const pedido = await prisma.pedido.findFirst({
      where: { id, userId },
      include: {
        cliente: true,
        itens: {
          include: { produto: { select: { nome: true } } },
        },
        extras: true,
      },
    });

    if (!pedido) {
      throw new NotFoundError('Pedido');
    }

    return {
      id: pedido.id,
      numero: pedido.numero,
      cliente: {
        id: pedido.cliente.id,
        nome: pedido.cliente.nome,
      },
      dataPedido: pedido.dataPedido,
      prazoEntrega: pedido.prazoEntrega,
      status: pedido.status,
      valorTotal: Number(pedido.valorTotal),
      enviadoCliente: pedido.enviadoCliente,
      linkToken: pedido.linkToken,
      itens: pedido.itens.map((item) => ({
        id: item.id,
        produtoId: item.produtoId,
        produto: item.produto.nome,
        quantidade: item.quantidade,
        precoUnitario: Number(item.precoUnitario),
        subtotal: Number(item.subtotal),
      })),
      extras: pedido.extras.map((e) => ({
        id: e.id,
        nome: e.nome,
        valor: Number(e.valor),
      })),
    };
  }

  private async generateNumero(userId: string): Promise<string> {
    const last = await prisma.pedido.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { numero: true },
    });

    let nextNum = 1;
    if (last?.numero) {
      const match = last.numero.match(/(\d+)$/);
      if (match) nextNum = Number(match[1]) + 1;
    }

    return `PED-${String(nextNum).padStart(4, '0')}`;
  }

  async create(userId: string, data: CreatePedidoInput) {
    const cliente = await prisma.cliente.findFirst({
      where: { id: data.clienteId, userId, ativo: true },
    });
    if (!cliente) {
      throw new NotFoundError('Cliente');
    }

    const produtoIds = data.itens.map((i) => i.produtoId);
    const produtos = await prisma.produto.findMany({
      where: { id: { in: produtoIds }, userId, status: 'ATIVO' },
    });

    if (produtos.length !== produtoIds.length) {
      throw new AppError('Um ou mais produtos não encontrados ou indisponíveis', 400, 'INVALID_PRODUCTS');
    }

    const produtoMap = new Map(produtos.map((p) => [p.id, p]));

    const itensComPreco = data.itens.map((item) => {
      const produto = produtoMap.get(item.produtoId)!;
      const precoUnitario = item.precoUnitario ?? Number(produto.preco);
      const subtotal = precoUnitario * item.quantidade;
      return {
        produtoId: item.produtoId,
        quantidade: item.quantidade,
        precoUnitario: new Decimal(precoUnitario),
        subtotal: new Decimal(subtotal),
      };
    });

    const totalExtras = (data.extras ?? []).reduce((sum, e) => sum + e.valor, 0);
    const valorTotal = itensComPreco.reduce((sum, item) => sum + Number(item.subtotal), 0) + totalExtras;
    const numero = await this.generateNumero(userId);

    const pedido = await prisma.pedido.create({
      data: {
        userId,
        numero,
        clienteId: data.clienteId,
        dataPedido: new Date(data.dataPedido),
        prazoEntrega: new Date(data.prazoEntrega),
        valorTotal: new Decimal(valorTotal),
        itens: { create: itensComPreco },
        extras: {
          create: (data.extras ?? []).map((e) => ({ nome: e.nome, valor: e.valor })),
        },
      },
    });

    return this.findById(userId, pedido.id);
  }

  async update(userId: string, id: string, data: UpdatePedidoInput) {
    const existing = await prisma.pedido.findFirst({
      where: { id, userId },
      include: { itens: true, extras: true },
    });

    if (!existing) {
      throw new NotFoundError('Pedido');
    }

    if (existing.status !== 'PENDENTE') {
      throw new AppError('Apenas pedidos pendentes podem ser editados', 400, 'INVALID_STATUS');
    }

    const updateData: Record<string, unknown> = {};
    if (data.numero) updateData.numero = data.numero;
    if (data.clienteId) {
      const cliente = await prisma.cliente.findFirst({
        where: { id: data.clienteId, userId, ativo: true },
      });
      if (!cliente) throw new NotFoundError('Cliente');
      updateData.clienteId = data.clienteId;
    }
    if (data.dataPedido) updateData.dataPedido = new Date(data.dataPedido);
    if (data.prazoEntrega) updateData.prazoEntrega = new Date(data.prazoEntrega);

    await prisma.$transaction(async (tx) => {
      if (data.itens) {
        const produtoIds = data.itens.map((i) => i.produtoId);
        const produtos = await tx.produto.findMany({
          where: { id: { in: produtoIds }, userId, status: 'ATIVO' },
        });
        const produtoMap = new Map(produtos.map((p) => [p.id, p]));

        if (produtos.length !== produtoIds.length) {
          throw new AppError('Um ou mais produtos não encontrados ou indisponíveis', 400, 'INVALID_PRODUCTS');
        }

        const itensComPreco = data.itens.map((item) => {
          const produto = produtoMap.get(item.produtoId)!;
          const precoUnitario = item.precoUnitario ?? Number(produto.preco);
          const subtotal = precoUnitario * item.quantidade;
          return {
            produtoId: item.produtoId,
            quantidade: item.quantidade,
            precoUnitario: new Decimal(precoUnitario),
            subtotal: new Decimal(subtotal),
          };
        });

        const totalExtras = data.extras
          ? data.extras.reduce((sum, e) => sum + e.valor, 0)
          : existing.extras.reduce((sum, e) => sum + Number(e.valor), 0);
        const valorTotal = itensComPreco.reduce((sum, item) => sum + Number(item.subtotal), 0) + totalExtras;

        await tx.itemPedido.deleteMany({ where: { pedidoId: id } });
        updateData.valorTotal = new Decimal(valorTotal);
        updateData.itens = { create: itensComPreco };
      }

      if (data.extras !== undefined) {
        await tx.extraPedido.deleteMany({ where: { pedidoId: id } });
        updateData.extras = {
          create: data.extras.map((e) => ({ nome: e.nome, valor: e.valor })),
        };

        if (!data.itens) {
          const totalItens = existing.itens.reduce((sum, item) => sum + Number(item.subtotal), 0);
          const totalExtras = data.extras.reduce((sum, e) => sum + e.valor, 0);
          updateData.valorTotal = new Decimal(totalItens + totalExtras);
        }
      }

      await tx.pedido.update({ where: { id }, data: updateData });
    });

    return this.findById(userId, id);
  }

  async updateStatus(userId: string, id: string, status: string) {
    const existing = await prisma.pedido.findFirst({ where: { id, userId } });

    if (!existing) {
      throw new NotFoundError('Pedido');
    }

    await prisma.pedido.update({
      where: { id },
      data: { status: status as 'PENDENTE' | 'APROVADO' | 'CONCLUIDO' | 'CANCELADO' },
    });

    return this.findById(userId, id);
  }

  async enviar(userId: string, id: string) {
    const existing = await prisma.pedido.findFirst({ where: { id, userId } });

    if (!existing) {
      throw new NotFoundError('Pedido');
    }

    const linkToken = existing.linkToken ?? randomUUID();

    await prisma.pedido.update({
      where: { id },
      data: { enviadoCliente: true, linkToken },
    });

    return this.findById(userId, id);
  }

  async cancel(userId: string, id: string) {
    return this.updateStatus(userId, id, 'CANCELADO');
  }

  async findByToken(token: string) {
    const pedido = await prisma.pedido.findUnique({
      where: { linkToken: token },
      include: {
        cliente: { select: { nome: true } },
        itens: {
          include: { produto: { select: { nome: true } } },
        },
        extras: true,
      },
    });

    if (!pedido) {
      throw new NotFoundError('Pedido');
    }

    return {
      numero: pedido.numero,
      cliente: pedido.cliente.nome,
      dataPedido: pedido.dataPedido,
      prazoEntrega: pedido.prazoEntrega,
      status: pedido.status,
      valorTotal: Number(pedido.valorTotal),
      itens: pedido.itens.map((item) => ({
        produto: item.produto.nome,
        quantidade: item.quantidade,
        precoUnitario: Number(item.precoUnitario),
        subtotal: Number(item.subtotal),
      })),
      extras: pedido.extras.map((e) => ({
        nome: e.nome,
        valor: Number(e.valor),
      })),
    };
  }

  async aceitarByToken(token: string) {
    const pedido = await prisma.pedido.findUnique({
      where: { linkToken: token },
      include: { cliente: { select: { nome: true } } },
    });

    if (!pedido) {
      throw new NotFoundError('Pedido');
    }

    if (pedido.status === 'APROVADO') {
      return this.findByToken(token);
    }

    if (pedido.status !== 'PENDENTE') {
      throw new AppError('Este pedido não pode mais ser aprovado', 400, 'INVALID_STATUS');
    }

    await prisma.$transaction([
      prisma.pedido.update({
        where: { id: pedido.id },
        data: { status: 'APROVADO' },
      }),
      prisma.notificacao.create({
        data: {
          userId: pedido.userId,
          pedidoId: pedido.id,
          tipo: 'PEDIDO_APROVADO',
          titulo: 'Pedido aceito pelo cliente',
          mensagem: `${pedido.cliente.nome} aceitou o pedido ${pedido.numero}.`,
        },
      }),
    ]);

    return this.findByToken(token);
  }
}

export const pedidosService = new PedidosService();
