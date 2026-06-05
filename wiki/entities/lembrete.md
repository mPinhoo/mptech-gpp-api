---
type: entity
tags: [dominio, agenda]
---

# Lembrete

Lembrete agendado na agenda do usuário.

## Campos

- `titulo`, `descricao`
- `data`, `hora` (timezone BR)
- `notificado: boolean`

## Regras

- Máximo 5 por dia por usuário
- Agendamento deve ser data/hora futura
- Após `notificado: true`, não pode editar/excluir
- Job cria Notificacao `AGENDA_LEMBRETE` ao vencer

## Relacionado

- [[features/agenda]]
- [[notificacao]]
