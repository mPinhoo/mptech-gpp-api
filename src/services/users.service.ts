import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma.js';
import { ConflictError } from '../utils/errors.js';
import { CreateUserInput } from '../schemas/users.schema.js';
import { initializeNewUser } from './user-setup.service.js';

function formatUser(user: {
  id: string;
  nome: string;
  email: string;
  avatarUrl?: string | null;
  ativo: boolean;
  createdAt: Date;
}) {
  return {
    id: user.id,
    nome: user.nome,
    email: user.email,
    avatarUrl: user.avatarUrl ?? null,
    ativo: user.ativo,
    createdAt: user.createdAt,
  };
}

export class UsersService {
  async findAll() {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        nome: true,
        email: true,
        avatarUrl: true,
        ativo: true,
        createdAt: true,
      },
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

    const hashedPassword = await bcrypt.hash(data.senha, 10);

    const user = await prisma.user.create({
      data: {
        nome: data.nome,
        email: data.email,
        senha: hashedPassword,
      },
      select: {
        id: true,
        nome: true,
        email: true,
        avatarUrl: true,
        ativo: true,
        createdAt: true,
      },
    });

    await initializeNewUser(user.id);

    return formatUser(user);
  }
}

export const usersService = new UsersService();
