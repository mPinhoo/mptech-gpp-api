---
type: feature
menu: precificacao
tags: [funcionalidade]
---

# Precificação (Config Global)

Configuração de custos, taxas e parâmetros de mão de obra usados no cálculo de preço dos produtos.

## Rotas UI

| Rota | Menu RBAC |
|------|-----------|
| `/precificacao` | `precificacao` |

## Endpoints API

| Método | Rota |
|--------|------|
| GET | `/api/precificacao` |
| PUT | `/api/precificacao` |

## Campos de configuração

**Mão de obra:** salário mensal, horas/semana, semanas/mês

**Custos fixos:** lista dinâmica (nome + valor mensal)

**Rateio:** dias trabalhados/mês, horas/dia

**Taxas %:** marketplace, cartão, impostos, adicionais

## Regras de negócio

- Salvar exige permissão `editar` em `precificacao`
- Resumo calcula custo/hora MO e rateio/hora CF em tempo real
- Config alimenta formulários de produto
- Novo usuário recebe config vazia no onboarding

## Regras técnicas

- API armazena apenas; cálculo no frontend
- PUT substitui integralmente lista de `custosFixos`
- Relação 1:1 com User

## Relacionado

- [[precificacao-formulas]]
- [[produto]]
- [[features/produtos]]
