---
type: entity
tags: [dominio, core]
---

# Pedido

Pedido comercial — entidade central do sistema.

## Campos principais

- `numero` (PED-XXXX, único por tenant)
- `status`: PENDENTE, APROVADO, CONCLUIDO, CANCELADO
- `dataPedido`, `prazoEntrega`
- `valorTotal`, `enviadoCliente`
- `linkToken` (UUID para portal público)
- `kanbanColunaId`

## Relacionamentos

- N:1 → [[cliente]], [[user]]
- 1:N → ItemPedido, ExtraPedido
- N:1 → KanbanColuna (opcional)

## Regras

Ver [[ciclo-vida-pedido]] para fluxo completo.

## Relacionado

- [[features/pedidos]]
- [[features/kanban]]
- [[features/portal-publico]]
- [[alertas-prazo]]
