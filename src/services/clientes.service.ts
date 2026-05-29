import prisma from '../utils/prisma.js';
import { NotFoundError } from '../utils/errors.js';
import { CreateClienteInput, UpdateClienteInput } from '../schemas/cliente.schema.js';
import { buildOrderBy, ListFilters, parseSortOrder } from '../utils/sort.js';

function clienteOrderBy(sortBy?: string, sortOrder?: 'asc' | 'desc') {
  const order = parseSortOrder(sortOrder);
  return buildOrderBy(
    sortBy,
    sortOrder,
    {
      nome: { nome: order },
      email: { email: order },
      telefone: { telefone: order },
      documento: { documento: order },
      endereco: { endereco: order },
      createdAt: { createdAt: order },
    },
    { nome: 'asc' }
  );
}

export class ClientesService {
  async findAll(
    userId: string,
    filters: ListFilters & { nome?: string; email?: string; documento?: string }
  ) {
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { userId, ativo: true };

    if (filters.nome) {
      where.nome = { contains: filters.nome, mode: 'insensitive' };
    }

    if (filters.email) {
      where.email = { contains: filters.email, mode: 'insensitive' };
    }

    if (filters.documento) {
      where.documento = { contains: filters.documento, mode: 'insensitive' };
    }

    if (filters.search) {
      where.OR = [
        { nome: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { documento: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [clientes, total] = await Promise.all([
      prisma.cliente.findMany({
        where,
        skip,
        take: limit,
        orderBy: clienteOrderBy(filters.sortBy, filters.sortOrder),
      }),
      prisma.cliente.count({ where }),
    ]);

    return {
      data: clientes.map((c) => ({
        id: c.id,
        nome: c.nome,
        email: c.email,
        telefone: c.telefone,
        documento: c.documento,
        endereco: c.endereco,
      })),
      meta: { page, limit, total },
    };
  }

  async findById(userId: string, id: string) {
    const cliente = await prisma.cliente.findFirst({
      where: { id, userId },
      include: {
        pedidos: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { itens: true },
        },
      },
    });

    if (!cliente || !cliente.ativo) {
      throw new NotFoundError('Cliente');
    }

    return {
      id: cliente.id,
      nome: cliente.nome,
      email: cliente.email,
      telefone: cliente.telefone,
      documento: cliente.documento,
      endereco: cliente.endereco,
      pedidos: cliente.pedidos.map((p) => ({
        id: p.id,
        numero: p.numero,
        dataPedido: p.dataPedido,
        status: p.status,
        valorTotal: Number(p.valorTotal),
      })),
    };
  }

  async create(userId: string, data: CreateClienteInput) {
    const cliente = await prisma.cliente.create({
      data: {
        userId,
        nome: data.nome,
        email: data.email || null,
        telefone: data.telefone || null,
        documento: data.documento || null,
        endereco: data.endereco || null,
      },
    });

    return {
      id: cliente.id,
      nome: cliente.nome,
      email: cliente.email,
      telefone: cliente.telefone,
      documento: cliente.documento,
      endereco: cliente.endereco,
    };
  }

  async update(userId: string, id: string, data: UpdateClienteInput) {
    const existing = await prisma.cliente.findFirst({ where: { id, userId } });
    if (!existing || !existing.ativo) {
      throw new NotFoundError('Cliente');
    }

    const cliente = await prisma.cliente.update({
      where: { id },
      data: {
        nome: data.nome,
        email: data.email || undefined,
        telefone: data.telefone || undefined,
        documento: data.documento || undefined,
        endereco: data.endereco || undefined,
      },
    });

    return {
      id: cliente.id,
      nome: cliente.nome,
      email: cliente.email,
      telefone: cliente.telefone,
      documento: cliente.documento,
      endereco: cliente.endereco,
    };
  }

  async delete(userId: string, id: string) {
    const existing = await prisma.cliente.findFirst({ where: { id, userId } });
    if (!existing) {
      throw new NotFoundError('Cliente');
    }

    await prisma.cliente.update({
      where: { id },
      data: { ativo: false },
    });
  }
}

export const clientesService = new ClientesService();
