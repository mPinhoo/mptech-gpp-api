import prisma from '../utils/prisma.js';
import { NotFoundError, ConflictError, AppError } from '../utils/errors.js';
import {
  CreateGrupoPermissaoInput,
  UpdateGrupoPermissaoInput,
} from '../schemas/permissoes.schema.js';
import { MENU_KEYS, mergePermissoes, createEmptyPermissoes } from '../constants/menus.js';

function formatGrupo(grupo: {
  id: string;
  nome: string;
  descricao: string | null;
  sistema: boolean;
  createdAt: Date;
  updatedAt: Date;
  permissoes: Array<{
    menu: string;
    leitura: boolean;
    criar: boolean;
    editar: boolean;
  }>;
  _count?: { users: number };
}) {
  return {
    id: grupo.id,
    nome: grupo.nome,
    descricao: grupo.descricao,
    sistema: grupo.sistema,
    createdAt: grupo.createdAt,
    updatedAt: grupo.updatedAt,
    permissoes: mergePermissoes(
      grupo.permissoes.map((p) => ({
        menu: p.menu as (typeof MENU_KEYS)[number],
        leitura: p.leitura,
        criar: p.criar,
        editar: p.editar,
      }))
    ),
    ...(grupo._count ? { totalUsuarios: grupo._count.users } : {}),
  };
}

export class PermissoesService {
  async findAllGrupos() {
    const grupos = await prisma.grupoPermissao.findMany({
      include: {
        permissoes: true,
        _count: { select: { users: true } },
      },
      orderBy: { nome: 'asc' },
    });

    return grupos.map(formatGrupo);
  }

  async findGrupoById(id: string) {
    const grupo = await prisma.grupoPermissao.findUnique({
      where: { id },
      include: {
        permissoes: true,
        _count: { select: { users: true } },
      },
    });

    if (!grupo) {
      throw new NotFoundError('Grupo de permissões');
    }

    return formatGrupo(grupo);
  }

  async createGrupo(data: CreateGrupoPermissaoInput) {
    const existing = await prisma.grupoPermissao.findUnique({
      where: { nome: data.nome },
    });

    if (existing) {
      throw new ConflictError('Já existe um grupo com este nome');
    }

    const permissoes = data.permissoes ?? createEmptyPermissoes();

    const grupo = await prisma.grupoPermissao.create({
      data: {
        nome: data.nome,
        descricao: data.descricao,
        permissoes: {
          create: permissoes.map((p) => ({
            menu: p.menu,
            leitura: p.leitura,
            criar: p.criar,
            editar: p.editar,
          })),
        },
      },
      include: { permissoes: true, _count: { select: { users: true } } },
    });

    return formatGrupo(grupo);
  }

  async updateGrupo(id: string, data: UpdateGrupoPermissaoInput) {
    const grupo = await prisma.grupoPermissao.findUnique({ where: { id } });

    if (!grupo) {
      throw new NotFoundError('Grupo de permissões');
    }

    if (data.nome && data.nome !== grupo.nome) {
      const existing = await prisma.grupoPermissao.findUnique({
        where: { nome: data.nome },
      });
      if (existing) {
        throw new ConflictError('Já existe um grupo com este nome');
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.grupoPermissao.update({
        where: { id },
        data: {
          ...(data.nome !== undefined ? { nome: data.nome } : {}),
          ...(data.descricao !== undefined ? { descricao: data.descricao } : {}),
        },
      });

      if (data.permissoes) {
        for (const permissao of data.permissoes) {
          await tx.permissaoMenu.upsert({
            where: {
              grupoId_menu: { grupoId: id, menu: permissao.menu },
            },
            create: {
              grupoId: id,
              menu: permissao.menu,
              leitura: permissao.leitura,
              criar: permissao.criar,
              editar: permissao.editar,
            },
            update: {
              leitura: permissao.leitura,
              criar: permissao.criar,
              editar: permissao.editar,
            },
          });
        }
      }
    });

    return this.findGrupoById(id);
  }

  async deleteGrupo(id: string) {
    const grupo = await prisma.grupoPermissao.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });

    if (!grupo) {
      throw new NotFoundError('Grupo de permissões');
    }

    if (grupo.sistema) {
      throw new AppError('Grupos do sistema não podem ser excluídos', 400, 'GRUPO_SISTEMA');
    }

    if (grupo._count.users > 0) {
      throw new AppError(
        'Grupo possui usuários vinculados e não pode ser excluído',
        400,
        'GRUPO_EM_USO'
      );
    }

    await prisma.grupoPermissao.delete({ where: { id } });
  }
}

export const permissoesService = new PermissoesService();
