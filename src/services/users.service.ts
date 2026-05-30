import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma.js';
import { ConflictError, NotFoundError } from '../utils/errors.js';
import { CreateUserInput, UpdateUserInput } from '../schemas/users.schema.js';
import { initializeNewUser } from './user-setup.service.js';
import { validateAvatarUrl } from '../utils/avatar.js';
import { formatDocumento } from '../utils/documento.js';

type UserRecord = {
  id: string;
  nome: string;
  email: string;
  avatarUrl?: string | null;
  ativo: boolean;
  documento?: string | null;
  dataNascimento?: Date | null;
  nomeFantasia?: string | null;
  usarNomeFantasia: boolean;
  genero?: string | null;
  nacionalidade?: string | null;
  telefone?: string | null;
  endereco?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cep?: string | null;
  pais?: string | null;
  estado?: string | null;
  cidade?: string | null;
  createdAt: Date;
  grupoPermissaoId?: string | null;
  grupoPermissao?: { id: string; nome: string } | null;
};

function formatUser(user: UserRecord) {
  return {
    id: user.id,
    nome: user.nome,
    email: user.email,
    avatarUrl: user.avatarUrl ?? null,
    ativo: user.ativo,
    documento: user.documento ?? null,
    documentoFormatado: user.documento ? formatDocumento(user.documento) : null,
    dataNascimento: user.dataNascimento ?? null,
    nomeFantasia: user.nomeFantasia ?? null,
    usarNomeFantasia: user.usarNomeFantasia,
    genero: user.genero ?? null,
    nacionalidade: user.nacionalidade ?? null,
    telefone: user.telefone ?? null,
    endereco: user.endereco ?? null,
    numero: user.numero ?? null,
    complemento: user.complemento ?? null,
    bairro: user.bairro ?? null,
    cep: user.cep ?? null,
    pais: user.pais ?? null,
    estado: user.estado ?? null,
    cidade: user.cidade ?? null,
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
  documento: true,
  dataNascimento: true,
  nomeFantasia: true,
  usarNomeFantasia: true,
  genero: true,
  nacionalidade: true,
  telefone: true,
  endereco: true,
  numero: true,
  complemento: true,
  bairro: true,
  cep: true,
  pais: true,
  estado: true,
  cidade: true,
  createdAt: true,
  grupoPermissaoId: true,
  grupoPermissao: { select: { id: true, nome: true } },
} as const;

async function validateGrupoPermissao(grupoPermissaoId: string | null | undefined) {
  if (!grupoPermissaoId) return;
  const grupo = await prisma.grupoPermissao.findUnique({
    where: { id: grupoPermissaoId },
  });
  if (!grupo) {
    throw new NotFoundError('Grupo de permissões');
  }
}

function buildProfileData(data: {
  documento?: string;
  dataNascimento?: string;
  nomeFantasia?: string | null;
  usarNomeFantasia?: boolean;
  genero?: string;
  nacionalidade?: string;
  telefone?: string;
  avatarUrl?: string | null;
  endereco?: string;
  numero?: string;
  complemento?: string | null;
  bairro?: string;
  cep?: string;
  pais?: string;
  estado?: string;
  cidade?: string;
}) {
  const profile: Record<string, unknown> = {};

  if (data.documento !== undefined) profile.documento = data.documento;
  if (data.dataNascimento !== undefined) {
    profile.dataNascimento = new Date(`${data.dataNascimento}T12:00:00.000Z`);
  }
  if (data.nomeFantasia !== undefined) profile.nomeFantasia = data.nomeFantasia;
  if (data.usarNomeFantasia !== undefined) profile.usarNomeFantasia = data.usarNomeFantasia;
  if (data.genero !== undefined) profile.genero = data.genero;
  if (data.nacionalidade !== undefined) profile.nacionalidade = data.nacionalidade;
  if (data.telefone !== undefined) profile.telefone = data.telefone;
  if (data.endereco !== undefined) profile.endereco = data.endereco || null;
  if (data.numero !== undefined) profile.numero = data.numero || null;
  if (data.complemento !== undefined) profile.complemento = data.complemento || null;
  if (data.bairro !== undefined) profile.bairro = data.bairro || null;
  if (data.cep !== undefined) profile.cep = data.cep || null;
  if (data.pais !== undefined) profile.pais = data.pais || null;
  if (data.estado !== undefined) profile.estado = data.estado || null;
  if (data.cidade !== undefined) profile.cidade = data.cidade || null;
  if (data.avatarUrl !== undefined) {
    validateAvatarUrl(data.avatarUrl);
    profile.avatarUrl = data.avatarUrl || null;
  }

  if (data.usarNomeFantasia === false) {
    profile.nomeFantasia = null;
  }

  return profile;
}

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

    await validateGrupoPermissao(data.grupoPermissaoId);

    validateAvatarUrl(data.avatarUrl);

    const hashedPassword = await bcrypt.hash(data.senha, 10);

    const user = await prisma.user.create({
      data: {
        nome: data.nome,
        email: data.email,
        senha: hashedPassword,
        ativo: data.ativo ?? true,
        grupoPermissaoId: data.grupoPermissaoId ?? null,
        ...buildProfileData(data),
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

    if (data.email && data.email !== user.email) {
      const existing = await prisma.user.findUnique({
        where: { email: data.email },
      });
      if (existing) {
        throw new ConflictError('Email já cadastrado');
      }
    }

    await validateGrupoPermissao(data.grupoPermissaoId);

    const updateData: Record<string, unknown> = {
      ...buildProfileData(data),
    };

    if (data.nome !== undefined) updateData.nome = data.nome;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.ativo !== undefined) updateData.ativo = data.ativo;
    if (data.grupoPermissaoId !== undefined) {
      updateData.grupoPermissaoId = data.grupoPermissaoId;
    }

    if (data.senha) {
      updateData.senha = await bcrypt.hash(data.senha, 10);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: userSelect,
    });

    return formatUser(updated);
  }
}

export const usersService = new UsersService();
