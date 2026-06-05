---
type: feature
menu: administrativo_usuarios
tags: [funcionalidade, admin]
---

# Usuários (Administrativo)

Gestão global de usuários do sistema e impersonação.

## Rotas UI

| Rota | Menu RBAC |
|------|-----------|
| `/administrativo/usuarios` | `administrativo_usuarios` |

## Endpoints API

| Método | Rota | Extra |
|--------|------|-------|
| GET | `/api/users` | — |
| POST | `/api/users` | — |
| PUT | `/api/users/:id` | — |
| POST | `/api/users/:id/impersonate` | `requireRealAdmin` |

## Regras de negócio

- Listagem retorna **todos** os usuários (escopo global, não por tenant)
- Criação exige: nome, e-mail, CPF/CNPJ, data nascimento, gênero, nacionalidade, telefone
- CNPJ → gênero forçado para "Empresa"
- CEP validado (8 dígitos)
- Senha ≥ 6 chars (obrigatória na criação)
- Avatar: data URL, tipos imagem, validação de tamanho
- Formulário em abas: Dados pessoais / Endereço
- Impersonação: só admin, usuário ativo, não self, bloqueado durante impersonação

## Regras técnicas

- Validação CPF/CNPJ algorítmica (`documento.ts`)
- Grupo de permissão validado na criação/edição
- Componente: `UserFormModal.tsx`

## Relacionado

- [[user]]
- [[grupo-permissao]]
- [[rbac]]
- [[features/autenticacao]]
- [[features/permissoes]]
