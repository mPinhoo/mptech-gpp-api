---
type: feature
menu: home
tags: [funcionalidade]
---

# Dashboard (Home)

Painel principal com KPIs, notificações e lembretes do dia.

## Rotas UI

| Rota | Menu RBAC |
|------|-----------|
| `/home` | `home` |

## Endpoints API

| Método | Rota | Query |
|--------|------|-------|
| GET | `/api/dashboard/stats` | `dataDe`, `dataAte` |
| GET | `/api/dashboard/chart` | `dataDe`, `dataAte` |

## Regras de negócio

- Período padrão: 1º dia do mês atual até hoje
- 4 KPIs: Total Pedidos, Faturamento, Despesas, Saldo
- Faturamento: soma `valorTotal` de pedidos APROVADO + CONCLUIDO
- Despesas: soma `Despesa.valor` (geradas por entradas de estoque)
- Saldo = Faturamento − Despesas
- Trends: % variação vs período anterior de mesma duração
- Trend de despesas: positivo quando **diminui**
- Gráfico: semanal se ≤45 dias; mensal se >45

## Regras técnicas

- Debounce 400ms antes de buscar stats
- `GET /dashboard/chart` existe mas **não é usado** na UI atual
- Inconsistência: stats filtra faturamento por `dataPedido`; chart por `createdAt`
- Componentes: `StatCard`, `NotificationCenter`, `AgendaReminders`, `DateRangePicker`

## Relacionado

- [[features/notificacoes]]
- [[features/agenda]]
- [[pedido]]
