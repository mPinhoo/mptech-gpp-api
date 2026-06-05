---
type: entity
tags: [dominio]
---

# Produto

Item vendável do catálogo.

## Campos

- `nome`, `categoria`, `preco`, `status`, `tempoProducao` (minutos)
- Categorias: Festa, Brindes, Outros, Empresas
- Status: ATIVO, INATIVO, FORA_DE_CICLO

## Relacionamentos

- 1:N → MaterialProduto (BOM) → [[materia-prima]]
- 1:N → ItemPedido

## Regras

- DELETE = soft (status INATIVO)
- Só ATIVO em pedidos
- BOM: custo material = `precoCusto × quantidade`
- Precificação calculada no frontend ([[precificacao-formulas]])

## Relacionado

- [[materia-prima]]
- [[features/produtos]]
- [[features/precificacao]]
