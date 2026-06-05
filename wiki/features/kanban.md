---
type: feature
menu: area_trabalho
tags: [funcionalidade, producao]
---

# Área de Trabalho (Kanban)

Board de produção para pedidos aprovados.

## Rotas UI

| Rota | Menu RBAC |
|------|-----------|
| `/area-trabalho` | `area_trabalho` |

## Endpoints API

| Método | Rota |
|--------|------|
| GET | `/api/kanban/colunas` |
| POST | `/api/kanban/colunas` |
| PUT | `/api/kanban/colunas/reorder` |
| PUT | `/api/kanban/colunas/:id` |
| DELETE | `/api/kanban/colunas/:id` |
| PUT | `/api/kanban/pedidos/:id/mover` |
| PUT | `/api/kanban/pedidos/:id/arquivar` |
| PUT | `/api/kanban/colunas/:id/arquivar-todos` |

## Regras de negócio

- Só pedidos **APROVADO** no board
- Coluna backlog "Pedidos Aprovados" (`semColuna`): aprovados sem coluna
- Colunas sistema (criadas no onboarding): Aguardando Produção, Em Produção, Finalizado
- Colunas sistema: não editam/excluem nome
- Coluna "Finalizado": arquivar pedido → CONCLUIDO, limpa coluna e linkToken
- "Arquivar todos" na coluna Finalizado
- Excluir coluna customizada: pedidos voltam ao backlog
- Cards com alerta de prazo: borda vermelha ([[alertas-prazo]])
- Read-only sem permissão `editar`

## Regras técnicas

- Drag-and-drop de pedidos entre colunas
- Drag-and-drop para reordenar colunas (exceto backlog)
- `calcularAlertaPrazo` em cada card

## Relacionado

- [[pedido]]
- [[ciclo-vida-pedido]]
- [[alertas-prazo]]
- [[features/pedidos]]
