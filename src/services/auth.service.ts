import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma.js';
import { signToken, type JwtPayload } from '../utils/jwt.js';
import { UnauthorizedError, ConflictError, ForbiddenError, AppError, NotFoundError } from '../utils/errors.js';
import { LoginInput, RegisterInput, UpdateProfileInput } from '../schemas/auth.schema.js';
import { initializeNewUser } from './user-setup.service.js';
import { validateAvatarUrl } from '../utils/avatar.js';
import { getUserPermissoes } from './permissions.service.js';
import { MenuPermissao } from '../constants/menus.js';
import { isAdminEmail } from '../utils/admin.js';

const userAuthSelect = {
  id: true,
  nome: true,
  email: true,
  avatarUrl: true,
  ativo: true,
  createdAt: true,
  grupoPermissaoId: true,
  grupoPermissao: { select: { id: true, nome: true } },
} as const;

type AuthUserRecord = {
  id: string;
  nome: string;
  email: string;
  avatarUrl?: string | null;
  ativo?: boolean;
  createdAt?: Date;
  grupoPermissaoId?: string | null;
  grupoPermissao?: { id: string; nome: string } | null;
};

async function buildAuthUser(user: AuthUserRecord, jwtPayload?: JwtPayload) {
  const permissoes: MenuPermissao[] = await getUserPermissoes(user.id, user.email);
  const isImpersonating = !!jwtPayload?.impersonatedBy;

  const base = {
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
    isAdmin: isImpersonating ? false : isAdminEmail(user.email),
    permissoes,
    isImpersonating,
  };

  if (!isImpersonating || !jwtPayload?.impersonatedBy) {
    return base;
  }

  const admin = await prisma.user.findUnique({
    where: { id: jwtPayload.impersonatedBy },
    select: { id: true, nome: true, email: true },
  });

  return {
    ...base,
    impersonatedBy: admin
      ? { id: admin.id, nome: admin.nome, email: admin.email }
      : {
          id: jwtPayload.impersonatedBy,
          nome: 'Administrador',
          email: jwtPayload.impersonatedByEmail ?? '',
        },
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

  async me(userId: string, jwtPayload?: JwtPayload) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: userAuthSelect,
    });

    if (!user) {
      throw new UnauthorizedError('Usuário não encontrado');
    }

    return buildAuthUser(user, jwtPayload);
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

  async impersonate(adminUserId: string, adminEmail: string, targetUserId: string) {
    if (!isAdminEmail(adminEmail)) {
      throw new ForbiddenError('Acesso restrito a administradores');
    }

    if (adminUserId === targetUserId) {
      throw new AppError('Não é possível impersonar a si mesmo', 400);
    }

    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: userAuthSelect,
    });

    if (!target) {
      throw new NotFoundError('Usuário');
    }

    if (!target.ativo) {
      throw new AppError('Usuário inativo não pode ser impersonado', 400);
    }

    const token = signToken({
      userId: target.id,
      email: target.email,
      impersonatedBy: adminUserId,
      impersonatedByEmail: adminEmail,
    });

    const jwtPayload: JwtPayload = {
      userId: target.id,
      email: target.email,
      impersonatedBy: adminUserId,
      impersonatedByEmail: adminEmail,
    };

    return {
      token,
      user: await buildAuthUser(target, jwtPayload),
    };
  }

  async stopImpersonate(jwtPayload: JwtPayload) {
    if (!jwtPayload.impersonatedBy) {
      throw new AppError('Você não está impersonando nenhum usuário', 400);
    }

    const admin = await prisma.user.findUnique({
      where: { id: jwtPayload.impersonatedBy },
      select: userAuthSelect,
    });

    if (!admin || !admin.ativo) {
      throw new UnauthorizedError('Administrador não encontrado');
    }

    const token = signToken({ userId: admin.id, email: admin.email });

    return {
      token,
      user: await buildAuthUser(admin),
    };
  }
}

export const authService = new AuthService();
