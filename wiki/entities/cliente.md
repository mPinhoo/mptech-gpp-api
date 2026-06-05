---
type: entity
tags: [dominio]
---

# Cliente

Cliente comercial do tenant.

## Campos

- `nome` (obrigatório), `email`, `telefone`, `documento`
- Endereço completo
- `ativo: boolean` (soft delete)

## Regras

- Listagem retorna só `ativo: true`
- DELETE = `ativo: false`
- Detalhe inclui últimos 10 pedidos
- Busca por nome, email, documento (case-insensitive)
- Deve estar ativo para entrar em novo pedido

## Relacionado

- [[pedido]]
- [[features/clientes]]
