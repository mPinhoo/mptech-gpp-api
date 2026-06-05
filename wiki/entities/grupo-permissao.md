---
type: entity
tags: [dominio, seguranca]
---

# Grupo de Permissão

Agrupa usuários com o mesmo conjunto de permissões RBAC.

## Campos

- `nome`, `descricao`
- `sistema: boolean` — grupos protegidos (ex: Administrador)
- Relação 1:N com PermissaoMenu e User

## Regras

- Nome único (409 se duplicado)
- `sistema: true` → não excluível, nome não editável na UI
- Não exclui se `_count.users > 0`
- Seed cria "Administrador" com acesso total

## Relacionado

- [[rbac]]
- [[user]]
- [[features/permissoes]]
