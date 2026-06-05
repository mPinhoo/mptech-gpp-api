---
type: feature
menu: publico
tags: [funcionalidade]
---

# Portal Público do Cliente

Página sem autenticação para o cliente visualizar e aprovar pedidos.

## Rotas UI

| Rota | Auth |
|------|------|
| `/pedido/[token]` | Público |

## Endpoints API

| Método | Rota | Auth |
|--------|------|------|
| GET | `/api/public/pedidos/:token` | Não |
| POST | `/api/public/pedidos/:token/aceitar` | Não |

## Regras de negócio

- Token gerado em `POST /pedidos/:id/enviar` (UUID, preservado se já existir)
- Cliente vê itens, extras e valor total
- Aprovação só se `status === PENDENTE`
- Aceite → status APROVADO + notificação `PEDIDO_APROVADO` ao dono
- Idempotente: se já APROVADO, retorna sucesso
- URL pública: `{NEXT_PUBLIC_APP_URL}/pedido/{token}`

## Regras técnicas

- Fora do layout dashboard (sem sidebar/header)
- `public-api.ts` separado do `api.ts` autenticado
- Sair de APROVADO (edição/reversão) limpa `linkToken` no backend

## Relacionado

- [[pedido]]
- [[ciclo-vida-pedido]]
- [[features/pedidos]]
- [[features/notificacoes]]
