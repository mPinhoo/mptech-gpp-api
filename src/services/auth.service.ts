import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma.js';
import { signToken } from '../utils/jwt.js';
import { UnauthorizedError, ConflictError } from '../utils/errors.js';
import { LoginInput, RegisterInput } from '../schemas/auth.schema.js';

export class AuthService {
  async login(data: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user || !user.ativo) {
      throw new UnauthorizedError('Credenciais inválidas');
    }

    const validPassword = await bcrypt.compare(data.senha, user.senha);
    if (!validPassword) {
      throw new UnauthorizedError('Credenciais inválidas');
    }

    const token = signToken({ userId: user.id, email: user.email });

    return {
      token,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
      },
    };
  }

  async register(data: RegisterInput) {
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
    });

    const token = signToken({ userId: user.id, email: user.email });

    return {
      token,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
      },
    };
  }

  async me(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, nome: true, email: true, ativo: true, createdAt: true },
    });

    if (!user) {
      throw new UnauthorizedError('Usuário não encontrado');
    }

    return user;
  }
}

export const authService = new AuthService();
