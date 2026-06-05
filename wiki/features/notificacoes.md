---
type: feature
menu: home
tags: [funcionalidade]
---

# Notificações

Central de notificações in-app com polling automático.

## Rotas UI

- Widget no Header (`NotificationBell`)
- Seção completa em `/home#notificacoes`

## Endpoints API

| Método | Rota |
|--------|------|
| GET | `/api/notificacoes` |
| GET | `/api/notificacoes/contagem` |
| PATCH | `/api/notificacoes/:id/lida` |

## Tipos de notificação

| Tipo | Gatilho | Link na UI |
|------|---------|------------|
| `PEDIDO_APROVADO` | Cliente aceita pedido público | `/pedidos/:id` |
| `AGENDA_LEMBRETE` | Job de lembretes | `/agenda` |
| `PEDIDO_PRAZO_ALERTA` | Job de alertas de prazo | `/area-trabalho` |

## Regras de negócio

- Lista retorna apenas não lidas
- Marcar como lida remove da lista (não há exclusão física na UI)

## Regras técnicas

- `NotificationProvider` faz polling a cada **30 segundos** quando logado
- Menu RBAC: `home` (leitura)

## Relacionado

- [[notificacao]]
- [[alertas-prazo]]
- [[features/agenda]]
- [[features/pedidos]]
