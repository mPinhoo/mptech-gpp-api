import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma.js';
import { ConflictError, NotFoundError } from '../utils/errors.js';
import { CreateUserInput, UpdateUserInput } from '../schemas/users.schema.js';
import { initializeNewUser } from './user-setup.service.js';

function formatUser(user: {
  id: string;
  nome: string;
  email: string;
  avatarUrl?: string | null;
  ativo: boolean;
  createdAt: Date;
  grupoPermissaoId?: string | null;
  grupoPermissao?: { id: string; nome: string } | null;
}) {
  return {
    id: user.id,
    nome: user.nome,
    email: user.email,
    avatarUrl: user.avatarUrl ?? null,
    ativo: user.ativo,
    createdAt: user.createdAt,
    grupoPermissaoId: user.grupoPermissaoId ?? null,
    grupoPermissao: user.grupoPermissao
      ? { id: user.grupoPermissao.id, nome: user.grupoPermissao.nome }
      : null,
  };
}

const userSelect = {
  id: true,
  nome: true,
  email: true,
  avatarUrl: true,
  ativo: true,
  createdAt: true,
  grupoPermissaoId: true,
  grupoPermissao: { select: { id: true, nome: true } },
} as const;

export class UsersService {
  async findAll() {
    const users = await prisma.user.findMany({
      select: userSelect,
      orderBy: { createdAt: 'desc' },
    });

    return users.map(formatUser);
  }

  async create(data: CreateUserInput) {
    const existing = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existing) {
      throw new ConflictError('Email já cadastrado');
    }

    if (data.grupoPermissaoId) {
      const grupo = await prisma.grupoPermissao.findUnique({
        where: { id: data.grupoPermissaoId },
      });
      if (!grupo) {
        throw new NotFoundError('Grupo de permissões');
      }
    }

    const hashedPassword = await bcrypt.hash(data.senha, 10);

    const user = await prisma.user.create({
      data: {
        nome: data.nome,
        email: data.email,
        senha: hashedPassword,
        grupoPermissaoId: data.grupoPermissaoId ?? null,
      },
      select: userSelect,
    });

    await initializeNewUser(user.id);

    return formatUser(user);
  }

  async update(id: string, data: UpdateUserInput) {
    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundError('Usuário');
    }

    if (data.grupoPermissaoId) {
      const grupo = await prisma.grupoPermissao.findUnique({
        where: { id: data.grupoPermissaoId },
      });
      if (!grupo) {
        throw new NotFoundError('Grupo de permissões');
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { grupoPermissaoId: data.grupoPermissaoId },
      select: userSelect,
    });

    return formatUser(updated);
  }
}

export const usersService = new UsersService();
