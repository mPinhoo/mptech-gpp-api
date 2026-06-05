---
type: feature
menu: clientes
tags: [funcionalidade]
---

# Clientes

Cadastro e gestão de clientes do tenant.

## Rotas UI

| Rota | Menu RBAC |
|------|-----------|
| `/clientes` | `clientes` |

## Endpoints API

| Método | Rota |
|--------|------|
| GET | `/api/clientes` |
| GET | `/api/clientes/:id` |
| POST | `/api/clientes` |
| PUT | `/api/clientes/:id` |
| DELETE | `/api/clientes/:id` |

## Regras de negócio

- CRUD via modal
- Único campo obrigatório: **nome**
- Campos opcionais: e-mail, telefone, documento, endereço
- Soft delete: `ativo: false`
- Cliente inativo não pode entrar em novos pedidos
- Detalhe na API inclui últimos 10 pedidos

## Regras técnicas

- Filtros debounced: nome, e-mail, documento
- Paginação via `useTableList`
- Tenant-scoped por `userId`

## Relacionado

- [[cliente]]
- [[features/pedidos]]
