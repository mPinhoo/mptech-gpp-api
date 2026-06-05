---
type: concept
tags: [negocio, indice]
---

# Regras de Negócio — Índice

Compilação das principais regras de negócio do GPP/Zentra.

## Isolamento de dados

- Cada usuário é um tenant independente ([[multi-tenancy]])
- Exceções globais: gestão de usuários e grupos de permissão

## Pedidos

- Numeração sequencial por tenant (`PED-XXXX`)
- Ciclo: PENDENTE → APROVADO → CONCLUIDO ou CANCELADO ([[ciclo-vida-pedido]])
- Edição de APROVADO reverte para PENDENTE
- Envio ao cliente gera link público único
- Extras padrão na UI: alteração de arte (R$15), entrega (R$20), urgência (R$25), retirada (R$0)

## Produção (Kanban)

- Só pedidos APROVADOS no board
- 3 colunas sistema criadas no onboarding: Aguardando Produção, Em Produção, Finalizado
- Arquivar só na coluna Finalizado → CONCLUIDO

## Estoque

- Status calculado: Crítico (< mínimo), Baixo (≤ mínimo + 31), Normal
- Entrada gera despesa automaticamente
- Saída valida saldo disponível
- Exclusão bloqueada se material em uso em produtos

## Produtos

- Status: ATIVO, INATIVO, FORA_DE_CICLO
- Delete = soft (INATIVO)
- Só ATIVO em pedidos
- BOM liga produto a matérias-primas

## Agenda

- Máximo 5 lembretes por dia por usuário
- Horário deve ser futuro (timezone BR)
- Lembretes notificados não podem ser editados

## Precificação

- Config global por usuário alimenta cálculo por produto ([[precificacao-formulas]])

## Permissões

- 10 menus × 3 ações ([[rbac]])
- Admin tem acesso irrestrito

## Relacionado

- [[regras-tecnicas]]
- [[features/pedidos]]
- [[features/estoque]]
- [[features/produtos]]
