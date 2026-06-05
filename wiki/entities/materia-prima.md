---
type: entity
tags: [dominio, estoque]
---

# Matéria-prima

Insumo de estoque usado na produção (BOM).

## Campos

- `nome`, `unidade` (un, cm, m, g, kg, ml, L)
- `quantidade`, `quantidadeMinima`, `precoCusto`

## Status calculado

| Status | Condição |
|--------|----------|
| Crítico | quantidade < mínimo |
| Baixo | quantidade ≤ mínimo + 31 |
| Normal | acima |

## Regras

- Entrada incrementa qtd + cria Despesa
- Saída valida saldo (`INSUFFICIENT_STOCK`)
- Exclusão bloqueada se em MaterialProduto

## Relacionado

- [[produto]]
- [[features/estoque]]
