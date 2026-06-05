---
type: concept
tags: [arquitetura, negocio]
---

# Multi-tenancy

Cada [[user]] é um **tenant isolado**: clientes, produtos, estoque, pedidos, kanban, precificação e agenda pertencem exclusivamente ao `userId` do JWT.

## Regras de negócio

- Dados operacionais são sempre filtrados por `userId` extraído do token
- Novo usuário recebe configuração padrão via `initializeNewUser` (precificação vazia + 3 colunas kanban sistema)

## Exceções (escopo global)

| Módulo | Comportamento |
|--------|---------------|
| `/api/users` | Lista **todos** os usuários do sistema |
| `/api/permissoes` | Grupos de permissão globais |
| Rotas públicas | Acesso por `linkToken` sem autenticação |

## Regras técnicas

- `tenant.ts` extrai `userId` do payload JWT
- Cascade delete: remover User apaga todos os dados relacionados
- Índice único: `Pedido [userId, numero]`

## Relacionado

- [[user]]
- [[autenticacao-jwt]]
- [[features/usuarios]]
