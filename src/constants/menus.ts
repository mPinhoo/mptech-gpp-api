export const MENU_KEYS = [
  'home',
  'agenda',
  'pedidos',
  'area_trabalho',
  'produtos',
  'clientes',
  'estoque',
  'precificacao',
  'administrativo_usuarios',
  'administrativo_permissoes',
] as const;

export type MenuKey = (typeof MENU_KEYS)[number];

export type PermissaoAcao = 'leitura' | 'criar' | 'editar';

export const MENU_LABELS: Record<MenuKey, string> = {
  home: 'Home',
  agenda: 'Agenda',
  pedidos: 'Pedidos',
  area_trabalho: 'Área de Trabalho',
  produtos: 'Produtos',
  clientes: 'Clientes',
  estoque: 'Estoque',
  precificacao: 'Precificação',
  administrativo_usuarios: 'Administrativo · Usuários',
  administrativo_permissoes: 'Administrativo · Permissões',
};

export interface MenuPermissao {
  menu: MenuKey;
  leitura: boolean;
  criar: boolean;
  editar: boolean;
}

export function createEmptyPermissoes(): MenuPermissao[] {
  return MENU_KEYS.map((menu) => ({
    menu,
    leitura: false,
    criar: false,
    editar: false,
  }));
}

export function createFullPermissoes(): MenuPermissao[] {
  return MENU_KEYS.map((menu) => ({
    menu,
    leitura: true,
    criar: true,
    editar: true,
  }));
}

export function mergePermissoes(stored: MenuPermissao[]): MenuPermissao[] {
  const map = new Map(stored.map((p) => [p.menu, p]));
  return MENU_KEYS.map((menu) => {
    const item = map.get(menu);
    return {
      menu,
      leitura: item?.leitura ?? false,
      criar: item?.criar ?? false,
      editar: item?.editar ?? false,
    };
  });
}

export function hasPermissao(
  permissoes: MenuPermissao[],
  menu: MenuKey,
  acao: PermissaoAcao
): boolean {
  const item = permissoes.find((p) => p.menu === menu);
  return item?.[acao] ?? false;
}
