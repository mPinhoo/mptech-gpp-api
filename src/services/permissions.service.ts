import { Prisma } from '@prisma/client';
import prisma from '../utils/prisma.js';
import { isAdminEmail } from '../utils/admin.js';
import {
  MENU_KEYS,
  MenuKey,
  MenuPermissao,
  PermissaoAcao,
  createEmptyPermissoes,
  mergePermissoes,
  hasPermissao,
} from '../constants/menus.js';

export { MENU_KEYS, MenuKey, MenuPermissao, PermissaoAcao, hasPermissao };

export async function getUserPermissoes(userId: string, email: string): Promise<MenuPermissao[]> {
  if (isAdminEmail(email)) {
    return MENU_KEYS.map((menu) => ({
      menu,
      leitura: true,
      criar: true,
      editar: true,
    }));
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      grupoPermissao: {
        select: {
          permissoes: {
            select: { menu: true, leitura: true, criar: true, editar: true },
          },
        },
      },
    },
  });

  if (!user?.grupoPermissao) {
    return createEmptyPermissoes();
  }

  return mergePermissoes(
    user.grupoPermissao.permissoes.map((p) => ({
      menu: p.menu as MenuKey,
      leitura: p.leitura,
      criar: p.criar,
      editar: p.editar,
    }))
  );
}

export async function userCan(
  userId: string,
  email: string,
  menu: MenuKey,
  acao: PermissaoAcao
): Promise<boolean> {
  if (isAdminEmail(email)) return true;
  const permissoes = await getUserPermissoes(userId, email);
  return hasPermissao(permissoes, menu, acao);
}

export const DEFAULT_USER_GROUP = 'Usuário Zentra';

// Self-service accounts (sign-up or subscription) get every business menu. The
// administrativo menus manage all accounts, so they stay with platform staff.
export function ensureDefaultUserGroup(db: Prisma.TransactionClient = prisma) {
  return db.grupoPermissao.upsert({
    where: { nome: DEFAULT_USER_GROUP },
    update: {},
    create: {
      nome: DEFAULT_USER_GROUP,
      sistema: true,
      descricao: 'Todos os recursos do negócio, sem administração de contas',
      permissoes: {
        create: MENU_KEYS.filter((menu) => !menu.startsWith('administrativo')).map(
          (menu) => ({ menu, leitura: true, criar: true, editar: true })
        ),
      },
    },
  });
}

export async function ensureDefaultGrupoAdmin() {
  const existing = await prisma.grupoPermissao.findUnique({
    where: { nome: 'Administrador' },
  });

  if (existing) return existing;

  return prisma.grupoPermissao.create({
    data: {
      nome: 'Administrador',
      descricao: 'Acesso completo a todos os menus',
      sistema: true,
      permissoes: {
        create: MENU_KEYS.map((menu) => ({
          menu,
          leitura: true,
          criar: true,
          editar: true,
        })),
      },
    },
  });
}
