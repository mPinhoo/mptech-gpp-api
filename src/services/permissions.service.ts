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
