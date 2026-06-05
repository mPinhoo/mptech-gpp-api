---
type: entity
tags: [dominio]
---

# Notificação

Notificação in-app para o usuário.

## Tipos

| Tipo | Origem |
|------|--------|
| `PEDIDO_APROVADO` | Cliente aceita via link público |
| `AGENDA_LEMBRETE` | Job de lembretes vencidos |
| `PEDIDO_PRAZO_ALERTA` | Job de alertas de prazo |

## Regras

- Somente leitura e marcação como lida (sem criação manual via API)
- UI faz polling a cada 30s
- "Remover" = `PATCH /:id/lida`

## Relacionado

- [[features/notificacoes]]
- [[alertas-prazo]]
