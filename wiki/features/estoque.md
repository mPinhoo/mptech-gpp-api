---
type: feature
menu: estoque
tags: [funcionalidade]
---

# Estoque (Matéria-prima)

Gestão de insumos, entradas de estoque e geração automática de despesas.

## Rotas UI

| Rota | Menu RBAC |
|------|-----------|
| `/estoque` | `estoque` |

## Endpoints API

| Método | Rota |
|--------|------|
| GET | `/api/estoque` |
| GET | `/api/estoque/:id` |
| POST | `/api/estoque` |
| POST | `/api/estoque/entrada` |
| POST | `/api/estoque/saida` |
| PUT | `/api/estoque/:id` |
| DELETE | `/api/estoque/:id` |

## Regras de negócio

- Unidades: un, cm, m, g, kg, ml, L
- Status calculado: Normal, Baixo, Crítico (ver [[materia-prima]])
- **Entrada** incrementa quantidade + cria Despesa (custo = precoCusto × qtd)
- **Saída** valida saldo disponível
- Exclusão bloqueada se material vinculado a produtos
- Ação "Copiar material" pré-preenche formulário para novo cadastro

## Regras técnicas

- Filtro por status usa SQL raw por faixas de quantidade
- `POST /estoque/saida` existe na API mas **sem tela na UI**
- Despesas alimentam KPIs do dashboard

## Relacionado

- [[materia-prima]]
- [[produto]]
- [[features/produtos]]
- [[features/dashboard]]
