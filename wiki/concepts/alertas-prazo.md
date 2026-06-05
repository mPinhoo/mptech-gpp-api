---
type: concept
tags: [negocio, kanban, notificacoes]
---

# Alertas de Prazo

Sistema automático de notificação quando pedidos aprovados estão próximos do prazo de entrega.

## Regras de negócio

- Condição: pedido `APROVADO` em coluna de produção + prazo ≤ 3 dias
- Colunas monitoradas: "Aguardando Produção", "Em Produção", "Produzindo"
- Máximo **1 notificação por dia** por pedido
- Tipos de mensagem: atrasado, vence hoje, vence em N dias

## Regras técnicas

- Job executa a cada 60s (`prazo-alerta.service.ts`)
- Tipo de notificação: `PEDIDO_PRAZO_ALERTA`
- UI: cards no Kanban com borda vermelha (`alertaPrazo`)
- Link da notificação → `/area-trabalho`

## Relacionado

- [[pedido]]
- [[notificacao]]
- [[ciclo-vida-pedido]]
- [[features/kanban]]
- [[features/notificacoes]]
