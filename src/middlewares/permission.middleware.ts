import { Request, Response, NextFunction } from 'express';
import { MenuKey, PermissaoAcao } from '../constants/menus.js';
import { userCan } from '../services/permissions.service.js';
import { ForbiddenError } from '../utils/errors.js';

export function requirePermission(menu: MenuKey, acao: PermissaoAcao) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new ForbiddenError('Não autorizado');
      }

      const allowed = await userCan(req.user.userId, req.user.email, menu, acao);
      if (!allowed) {
        throw new ForbiddenError('Você não tem permissão para esta ação');
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

interface RoutePermissionRule {
  method: string;
  pattern: RegExp;
  menu: MenuKey;
  acao: PermissaoAcao;
}

const ROUTE_PERMISSIONS: RoutePermissionRule[] = [
  { method: 'GET', pattern: /^\/dashboard(\/|$)/, menu: 'home', acao: 'leitura' },
  { method: 'GET', pattern: /^\/agenda(\/|$)/, menu: 'agenda', acao: 'leitura' },
  { method: 'POST', pattern: /^\/agenda(\/|$)/, menu: 'agenda', acao: 'criar' },
  { method: 'PUT', pattern: /^\/agenda\//, menu: 'agenda', acao: 'editar' },
  { method: 'DELETE', pattern: /^\/agenda\//, menu: 'agenda', acao: 'editar' },
  { method: 'GET', pattern: /^\/pedidos(\/|$)/, menu: 'pedidos', acao: 'leitura' },
  { method: 'POST', pattern: /^\/pedidos(\/|$)/, menu: 'pedidos', acao: 'criar' },
  { method: 'PUT', pattern: /^\/pedidos\//, menu: 'pedidos', acao: 'editar' },
  { method: 'DELETE', pattern: /^\/pedidos\//, menu: 'pedidos', acao: 'editar' },
  { method: 'GET', pattern: /^\/kanban(\/|$)/, menu: 'area_trabalho', acao: 'leitura' },
  { method: 'POST', pattern: /^\/kanban(\/|$)/, menu: 'area_trabalho', acao: 'criar' },
  { method: 'PUT', pattern: /^\/kanban\//, menu: 'area_trabalho', acao: 'editar' },
  { method: 'DELETE', pattern: /^\/kanban\//, menu: 'area_trabalho', acao: 'editar' },
  { method: 'GET', pattern: /^\/produtos(\/|$)/, menu: 'produtos', acao: 'leitura' },
  { method: 'POST', pattern: /^\/produtos(\/|$)/, menu: 'produtos', acao: 'criar' },
  { method: 'PUT', pattern: /^\/produtos\//, menu: 'produtos', acao: 'editar' },
  { method: 'DELETE', pattern: /^\/produtos\//, menu: 'produtos', acao: 'editar' },
  { method: 'GET', pattern: /^\/clientes(\/|$)/, menu: 'clientes', acao: 'leitura' },
  { method: 'POST', pattern: /^\/clientes(\/|$)/, menu: 'clientes', acao: 'criar' },
  { method: 'PUT', pattern: /^\/clientes\//, menu: 'clientes', acao: 'editar' },
  { method: 'DELETE', pattern: /^\/clientes\//, menu: 'clientes', acao: 'editar' },
  { method: 'POST', pattern: /^\/estoque\/entrada/, menu: 'estoque', acao: 'editar' },
  { method: 'POST', pattern: /^\/estoque\/saida/, menu: 'estoque', acao: 'editar' },
  { method: 'POST', pattern: /^\/estoque(\/)?$/, menu: 'estoque', acao: 'criar' },
  { method: 'PUT', pattern: /^\/estoque\//, menu: 'estoque', acao: 'editar' },
  { method: 'DELETE', pattern: /^\/estoque\//, menu: 'estoque', acao: 'editar' },
  { method: 'GET', pattern: /^\/estoque(\/|$)/, menu: 'estoque', acao: 'leitura' },
  { method: 'GET', pattern: /^\/precificacao(\/|$)/, menu: 'precificacao', acao: 'leitura' },
  { method: 'PUT', pattern: /^\/precificacao(\/|$)/, menu: 'precificacao', acao: 'editar' },
  { method: 'GET', pattern: /^\/notificacoes(\/|$)/, menu: 'home', acao: 'leitura' },
  { method: 'PATCH', pattern: /^\/notificacoes\//, menu: 'home', acao: 'editar' },
  { method: 'GET', pattern: /^\/users(\/|$)/, menu: 'administrativo_usuarios', acao: 'leitura' },
  { method: 'POST', pattern: /^\/users(\/|$)/, menu: 'administrativo_usuarios', acao: 'criar' },
  { method: 'POST', pattern: /^\/users\/[^/]+\/impersonate$/, menu: 'administrativo_usuarios', acao: 'editar' },
  { method: 'PUT', pattern: /^\/users\//, menu: 'administrativo_usuarios', acao: 'editar' },
  { method: 'GET', pattern: /^\/permissoes(\/|$)/, menu: 'administrativo_permissoes', acao: 'leitura' },
  { method: 'POST', pattern: /^\/permissoes(\/|$)/, menu: 'administrativo_permissoes', acao: 'criar' },
  { method: 'PUT', pattern: /^\/permissoes\//, menu: 'administrativo_permissoes', acao: 'editar' },
  { method: 'DELETE', pattern: /^\/permissoes\//, menu: 'administrativo_permissoes', acao: 'editar' },
];

function resolveRoutePermission(method: string, path: string): RoutePermissionRule | null {
  for (const rule of ROUTE_PERMISSIONS) {
    if (rule.method === method && rule.pattern.test(path)) {
      return rule;
    }
  }
  return null;
}

export async function permissionMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      next();
      return;
    }

    const path = req.baseUrl + req.path;
    const rule = resolveRoutePermission(req.method, path);

    if (!rule) {
      next();
      return;
    }

    const allowed = await userCan(req.user.userId, req.user.email, rule.menu, rule.acao);
    if (!allowed) {
      throw new ForbiddenError('Você não tem permissão para esta ação');
    }

    next();
  } catch (err) {
    next(err);
  }
}
