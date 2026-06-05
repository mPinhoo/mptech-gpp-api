---
type: feature
menu: agenda
tags: [funcionalidade]
---

# Agenda

Calendário mensal com lembretes e visualização de pedidos por prazo de entrega.

## Rotas UI

| Rota | Menu RBAC |
|------|-----------|
| `/agenda` | `agenda` |

## Endpoints API

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/agenda` | Lembretes no intervalo |
| GET | `/api/agenda/dia` | Lembretes de um dia |
| GET | `/api/agenda/pedidos` | Pedidos por prazo no intervalo |
| POST | `/api/agenda` | Criar lembrete |
| PUT | `/api/agenda/:id` | Atualizar lembrete |
| DELETE | `/api/agenda/:id` | Remover lembrete |

## Regras de negócio

- Calendário mensal com badges: pedidos (amarelo) por `prazoEntrega`, lembretes (azul)
- Pedidos exibidos exceto status CANCELADO
- **Máximo 5 lembretes por dia** por usuário
- Horário do lembrete deve ser **no futuro** (America/Sao_Paulo)
- Atalhos no dia atual: "Em 3 min", "Em 15 min", "Em 1 hora"
- Lembretes já notificados: somente leitura
- Job processa até 50 lembretes vencidos por ciclo (60s)

## Regras técnicas

- Permissões controlam botões criar/editar
- Widget "Lembretes de Hoje" na Home usa `GET /agenda/dia`

## Relacionado

- [[lembrete]]
- [[pedido]]
- [[features/notificacoes]]
