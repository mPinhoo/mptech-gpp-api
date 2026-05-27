import prisma from '../utils/prisma.js';
import { NotFoundError } from '../utils/errors.js';
import { CreateClienteInput, UpdateClienteInput } from '../schemas/cliente.schema.js';

export class ClientesService {
  async findAll(filters: { search?: string; page?: number; limit?: number }) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (filters.search) {
      where.OR = [
        { nome: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { documento: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    where.ativo = true;

    const [clientes, total] = await Promise.all([
      prisma.cliente.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
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

  async findById(id: string) {
    const cliente = await prisma.cliente.findUnique({
      where: { id },
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

  async create(data: CreateClienteInput) {
    const cliente = await prisma.cliente.create({
      data: {
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

  async update(id: string, data: UpdateClienteInput) {
    const existing = await prisma.cliente.findUnique({ where: { id } });
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

  async delete(id: string) {
    const existing = await prisma.cliente.findUnique({ where: { id } });
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
