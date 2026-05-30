import { z } from 'zod';
import { MENU_KEYS } from '../constants/menus.js';

const permissaoMenuSchema = z.object({
  menu: z.enum(MENU_KEYS),
  leitura: z.boolean(),
  criar: z.boolean(),
  editar: z.boolean(),
});

export const createGrupoPermissaoSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  descricao: z.string().optional(),
  permissoes: z.array(permissaoMenuSchema).optional(),
});

export const updateGrupoPermissaoSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').optional(),
  descricao: z.string().nullable().optional(),
  permissoes: z.array(permissaoMenuSchema).optional(),
});

export type CreateGrupoPermissaoInput = z.infer<typeof createGrupoPermissaoSchema>;
export type UpdateGrupoPermissaoInput = z.infer<typeof updateGrupoPermissaoSchema>;
