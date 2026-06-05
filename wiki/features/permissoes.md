---
type: feature
menu: administrativo_permissoes
tags: [funcionalidade, admin]
---

# Permissões (Administrativo)

Gestão de grupos RBAC e matriz de permissões por menu.

## Rotas UI

| Rota | Menu RBAC |
|------|-----------|
| `/administrativo/permissoes` | `administrativo_permissoes` |

## Endpoints API

| Método | Rota |
|--------|------|
| GET | `/api/permissoes/grupos` |
| GET | `/api/permissoes/grupos/:id` |
| POST | `/api/permissoes/grupos` |
| PUT | `/api/permissoes/grupos/:id` |
| DELETE | `/api/permissoes/grupos/:id` |

## Regras de negócio

- Grupos com `sistema: true`: nome não editável, não excluível
- Matriz 10 menus × 3 checkboxes (leitura, criar, editar)
- Desmarcar leitura → desmarca criar e editar
- Marcar criar/editar → marca leitura automaticamente
- Nome único (409 se duplicado)
- Exclusão bloqueada se grupo tem usuários vinculados
- Seed: grupo "Administrador" com acesso total

## Regras técnicas

- `mergePermissoes` garante todos os menus na resposta
- Upsert de permissões no update do grupo
- Escopo global (não filtrado por tenant)

## Relacionado

- [[rbac]]
- [[grupo-permissao]]
- [[user]]
- [[features/usuarios]]
