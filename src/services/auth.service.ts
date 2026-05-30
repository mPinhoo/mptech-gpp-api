import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma.js';
import { signToken } from '../utils/jwt.js';
import { UnauthorizedError, ConflictError } from '../utils/errors.js';
import { LoginInput, RegisterInput, UpdateProfileInput } from '../schemas/auth.schema.js';
import { initializeNewUser } from './user-setup.service.js';
import { validateAvatarUrl } from '../utils/avatar.js';
import { getUserPermissoes } from './permissions.service.js';
import { MenuPermissao } from '../constants/menus.js';
import { isAdminEmail } from '../utils/admin.js';

async function buildAuthUser(user: {
  id: string;
  nome: string;
  email: string;
  avatarUrl?: string | null;
  ativo?: boolean;
  createdAt?: Date;
  grupoPermissaoId?: string | null;
  grupoPermissao?: { id: string; nome: string } | null;
}) {
  const permissoes: MenuPermissao[] = await getUserPermissoes(user.id, user.email);

  return {
    id: user.id,
    nome: user.nome,
    email: user.email,
    avatarUrl: user.avatarUrl ?? null,
    ...(user.ativo !== undefined ? { ativo: user.ativo } : {}),
    ...(user.createdAt ? { createdAt: user.createdAt } : {}),
    grupoPermissaoId: user.grupoPermissaoId ?? null,
    grupoPermissao: user.grupoPermissao
      ? { id: user.grupoPermissao.id, nome: user.grupoPermissao.nome }
      : null,
    isAdmin: isAdminEmail(user.email),
    permissoes,
  };
}

export class AuthService {
  async login(data: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
      include: { grupoPermissao: { select: { id: true, nome: true } } },
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
      user: await buildAuthUser(user),
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
      include: { grupoPermissao: { select: { id: true, nome: true } } },
    });

    await initializeNewUser(user.id);

    const token = signToken({ userId: user.id, email: user.email });

    return {
      token,
      user: await buildAuthUser(user),
    };
  }

  async me(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nome: true,
        email: true,
        avatarUrl: true,
        ativo: true,
        createdAt: true,
        grupoPermissaoId: true,
        grupoPermissao: { select: { id: true, nome: true } },
      },
    });

    if (!user) {
      throw new UnauthorizedError('Usuário não encontrado');
    }

    return buildAuthUser(user);
  }

  async updateProfile(userId: string, data: UpdateProfileInput) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedError('Usuário não encontrado');
    }

    validateAvatarUrl(data.avatarUrl);

    const updateData: { nome?: string; avatarUrl?: string | null; senha?: string } = {};

    if (data.nome !== undefined) {
      updateData.nome = data.nome;
    }

    if (data.avatarUrl !== undefined) {
      updateData.avatarUrl = data.avatarUrl || null;
    }

    if (data.novaSenha) {
      const validPassword = await bcrypt.compare(data.senhaAtual!, user.senha);
      if (!validPassword) {
        throw new UnauthorizedError('Senha atual incorreta');
      }
      updateData.senha = await bcrypt.hash(data.novaSenha, 10);
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      include: { grupoPermissao: { select: { id: true, nome: true } } },
    });

    return buildAuthUser(updated);
  }
}

export const authService = new AuthService();
