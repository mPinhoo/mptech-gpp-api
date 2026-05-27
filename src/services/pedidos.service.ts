import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../utils/prisma.js';
import { NotFoundError, AppError } from '../utils/errors.js';
import { CreatePedidoInput, UpdatePedidoInput } from '../schemas/pedido.schema.js';

function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export class PedidosService {
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
        { numero: { contains: filters.search, mode: 'insensitive' } },
        { cliente: { nome: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    const [pedidos, total] = await Promise.all([
      prisma.pedido.findMany({
        where,
        skip,
        take: limit,
        include: { cliente: { select: { nome: true } } },
        orderBy: { createdAt: 'desc' },
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
      })),
      meta: { page, limit, total },
    };
  }

  async findById(id: string) {
    const pedido = await prisma.pedido.findUnique({
      where: { id },
      include: {
        cliente: true,
        itens: {
          include: { produto: { select: { nome: true } } },
        },
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
      itens: pedido.itens.map((item) => ({
        id: item.id,
        produtoId: item.produtoId,
        produto: item.produto.nome,
        quantidade: item.quantidade,
        precoUnitario: Number(item.precoUnitario),
        subtotal: Number(item.subtotal),
      })),
    };
  }

  private async generateNumero(): Promise<string> {
    const last = await prisma.pedido.findFirst({
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

  async create(data: CreatePedidoInput) {
    const cliente = await prisma.cliente.findUnique({ where: { id: data.clienteId } });
    if (!cliente || !cliente.ativo) {
      throw new NotFoundError('Cliente');
    }

    const produtoIds = data.itens.map((i) => i.produtoId);
    const produtos = await prisma.produto.findMany({
      where: { id: { in: produtoIds }, status: 'ATIVO' },
    });

    if (produtos.length !== produtoIds.length) {
      throw new AppError('Um ou mais produtos não encontrados ou indisponíveis', 400, 'INVALID_PRODUCTS');
    }

    const produtoMap = new Map(produtos.map((p) => [p.id, p]));

    const itensComPreco = data.itens.map((item) => {
      const produto = produtoMap.get(item.produtoId)!;
      const precoUnitario = Number(produto.preco);
      const subtotal = precoUnitario * item.quantidade;
      return {
        produtoId: item.produtoId,
        quantidade: item.quantidade,
        precoUnitario: new Decimal(precoUnitario),
        subtotal: new Decimal(subtotal),
      };
    });

    const valorTotal = itensComPreco.reduce((sum, item) => sum + Number(item.subtotal), 0);
    const numero = await this.generateNumero();

    const pedido = await prisma.pedido.create({
      data: {
        numero,
        clienteId: data.clienteId,
        dataPedido: new Date(data.dataPedido),
        prazoEntrega: new Date(data.prazoEntrega),
        valorTotal: new Decimal(valorTotal),
        itens: { create: itensComPreco },
      },
      include: {
        cliente: { select: { nome: true } },
        itens: { include: { produto: { select: { nome: true } } } },
      },
    });

    return {
      id: pedido.id,
      numero: pedido.numero,
      cliente: pedido.cliente.nome,
      dataPedido: pedido.dataPedido,
      prazoEntrega: pedido.prazoEntrega,
      status: pedido.status,
      valorTotal: Number(pedido.valorTotal),
      itens: pedido.itens.map((item) => ({
        id: item.id,
        produto: item.produto.nome,
        quantidade: item.quantidade,
        precoUnitario: Number(item.precoUnitario),
        subtotal: Number(item.subtotal),
      })),
    };
  }

  async update(id: string, data: UpdatePedidoInput) {
    const existing = await prisma.pedido.findUnique({
      where: { id },
      include: { itens: true },
    });

    if (!existing) {
      throw new NotFoundError('Pedido');
    }

    if (existing.status !== 'PENDENTE') {
      throw new AppError('Apenas pedidos pendentes podem ser editados', 400, 'INVALID_STATUS');
    }

    const updateData: Record<string, unknown> = {};
    if (data.numero) updateData.numero = data.numero;
    if (data.clienteId) updateData.clienteId = data.clienteId;
    if (data.dataPedido) updateData.dataPedido = new Date(data.dataPedido);
    if (data.prazoEntrega) updateData.prazoEntrega = new Date(data.prazoEntrega);

    if (data.itens) {
      const produtoIds = data.itens.map((i) => i.produtoId);
      const produtos = await prisma.produto.findMany({
        where: { id: { in: produtoIds }, status: 'ATIVO' },
      });
      const produtoMap = new Map(produtos.map((p) => [p.id, p]));

      const itensComPreco = data.itens.map((item) => {
        const produto = produtoMap.get(item.produtoId)!;
        const precoUnitario = Number(produto.preco);
        const subtotal = precoUnitario * item.quantidade;
        return {
          produtoId: item.produtoId,
          quantidade: item.quantidade,
          precoUnitario: new Decimal(precoUnitario),
          subtotal: new Decimal(subtotal),
        };
      });

      const valorTotal = itensComPreco.reduce((sum, item) => sum + Number(item.subtotal), 0);

      await prisma.$transaction(async (tx) => {
        await tx.itemPedido.deleteMany({ where: { pedidoId: id } });

        await tx.pedido.update({
          where: { id },
          data: {
            ...updateData,
            valorTotal: new Decimal(valorTotal),
            itens: { create: itensComPreco },
          },
        });
      });
    } else {
      await prisma.pedido.update({ where: { id }, data: updateData });
    }

    return this.findById(id);
  }

  async updateStatus(id: string, status: string) {
    const existing = await prisma.pedido.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundError('Pedido');
    }

    await prisma.pedido.update({
      where: { id },
      data: { status: status as 'PENDENTE' | 'APROVADO' | 'CONCLUIDO' | 'CANCELADO' },
    });

    return this.findById(id);
  }

  async enviar(id: string) {
    const existing = await prisma.pedido.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundError('Pedido');
    }

    await prisma.pedido.update({
      where: { id },
      data: { enviadoCliente: true },
    });

    return this.findById(id);
  }

  async cancel(id: string) {
    return this.updateStatus(id, 'CANCELADO');
  }
}

export const pedidosService = new PedidosService();
