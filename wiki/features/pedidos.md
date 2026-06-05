---
type: feature
menu: pedidos
tags: [funcionalidade, core]
---

# Pedidos

Gestão completa do ciclo comercial: criação, envio, aprovação e acompanhamento.

## Rotas UI

| Rota | Permissão |
|------|-----------|
| `/pedidos` | `pedidos` leitura |
| `/pedidos/novo` | `pedidos` criar |
| `/pedidos/[id]` | `pedidos` editar |

## Endpoints API

| Método | Rota |
|--------|------|
| GET | `/api/pedidos` |
| GET | `/api/pedidos/:id` |
| POST | `/api/pedidos` |
| PUT | `/api/pedidos/:id` |
| PUT | `/api/pedidos/:id/status` |
| POST | `/api/pedidos/:id/enviar` |
| DELETE | `/api/pedidos/:id` |

## Regras de negócio — listagem

- Filtros: número, cliente (debounce 1s, similaridade pg_trgm), período, status
- Status exibido: nome da coluna Kanban se existir, senão status do pedido
- Mudança inline de status só se PENDENTE ou APROVADO (opções: Aprovado/Cancelado)
- Exclusão com confirmação

## Regras de negócio — formulário

- Cliente, data pedido, prazo entrega obrigatórios; ≥1 produto
- Só produtos ATIVO (limit 100 na busca)
- Preço unitário editável por item (override do catálogo)
- Produto duplicado soma quantidade
- **Extras padrão:**
  - Alteração da arte — R$ 15
  - Entrega — R$ 20
  - Taxa de urgência — R$ 25
  - Retirada — R$ 0
- Total = itens + extras ativos
- "Salvar" vs "Enviar para Cliente": enviar gera `linkToken`
- Edição mostra link copiável `/pedido/{token}`

## Regras de negócio — API

Ver [[ciclo-vida-pedido]].

## Regras técnicas

- Numeração: `PED-0001` sequencial por tenant
- Busca cliente: pg_trgm threshold 0.25
- Query params: `status`, `search`, `numero`, `cliente`, `dataDe`, `dataAte`, paginação

## Relacionado

- [[pedido]]
- [[cliente]]
- [[produto]]
- [[ciclo-vida-pedido]]
- [[features/portal-publico]]
- [[features/kanban]]
