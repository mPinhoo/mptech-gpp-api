import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma.js';
import { signToken } from '../utils/jwt.js';
import { UnauthorizedError, ConflictError, AppError } from '../utils/errors.js';
import {
  LoginInput,
  RegisterInput,
  UpdateProfileInput,
  ForgotPasswordInput,
  ResetPasswordInput,
} from '../schemas/auth.schema.js';
import { initializeNewUser } from './user-setup.service.js';
import { validateAvatarUrl } from '../utils/avatar.js';
import { sendPasswordResetEmail } from './email.service.js';
import { generateResetToken, hashResetToken } from '../utils/reset-token.js';

function formatUser(user: {
  id: string;
  nome: string;
  email: string;
  avatarUrl?: string | null;
  ativo?: boolean;
  createdAt?: Date;
}) {
  return {
    id: user.id,
    nome: user.nome,
    email: user.email,
    avatarUrl: user.avatarUrl ?? null,
    ...(user.ativo !== undefined ? { ativo: user.ativo } : {}),
    ...(user.createdAt ? { createdAt: user.createdAt } : {}),
  };
}

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
      user: formatUser(user),
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

    await initializeNewUser(user.id);

    const token = signToken({ userId: user.id, email: user.email });

    return {
      token,
      user: formatUser(user),
    };
  }

  async me(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, nome: true, email: true, avatarUrl: true, ativo: true, createdAt: true },
    });

    if (!user) {
      throw new UnauthorizedError('Usuário não encontrado');
    }

    return formatUser(user);
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
      select: { id: true, nome: true, email: true, avatarUrl: true, ativo: true, createdAt: true },
    });

    return formatUser(updated);
  }

  async forgotPassword(data: ForgotPasswordInput) {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      throw new AppError('Você ainda não é um usuário Zentra!', 404, 'USER_NOT_FOUND');
    }

    if (!user.ativo) {
      throw new AppError('Conta desativada. Entre em contato com o suporte.', 403, 'FORBIDDEN');
    }

    const token = generateResetToken();
    const resetTokenHash = hashResetToken(token);
    const resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { resetTokenHash, resetTokenExpiresAt },
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/redefinir-senha?token=${token}`;

    await sendPasswordResetEmail(user.email, resetUrl, user.nome);

    return {
      message: 'Enviamos um link de redefinição de senha para o seu e-mail.',
    };
  }

  async resetPassword(data: ResetPasswordInput) {
    const resetTokenHash = hashResetToken(data.token);
    const now = new Date();

    const user = await prisma.user.findFirst({
      where: {
        resetTokenHash,
        resetTokenExpiresAt: { gt: now },
      },
    });

    if (!user) {
      throw new AppError('Link inválido ou expirado. Solicite uma nova redefinição de senha.', 400, 'INVALID_TOKEN');
    }

    const hashedPassword = await bcrypt.hash(data.novaSenha, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        senha: hashedPassword,
        resetTokenHash: null,
        resetTokenExpiresAt: null,
      },
    });

    return { message: 'Senha redefinida com sucesso!' };
  }
}

export const authService = new AuthService();
