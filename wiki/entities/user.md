---
type: entity
tags: [dominio]
---

# User

Usuário do sistema e raiz do tenant ([[multi-tenancy]]).

## Campos principais

- Identificação: nome, email, senha (hash bcrypt)
- Perfil: avatar (base64), CPF/CNPJ, data nascimento, gênero, nacionalidade, telefone
- Endereço: CEP, logradouro, número, complemento, bairro, cidade, UF
- Controle: `ativo`, `grupoPermissaoId`
- Reset senha: `resetTokenHash`, `resetTokenExpiresAt` (não implementado)

## Relacionamentos

- 1:N → Cliente, Produto, Pedido, MateriaPrima, KanbanColuna, Lembrete, Notificacao
- N:1 → [[grupo-permissao]]
- 1:1 → ConfigPrecificacao

## Regras

- Email único no registro
- Admin: `admin@mptech.com` / seed `senha123`
- Novo usuário: `initializeNewUser` cria precificação + colunas kanban

## Relacionado

- [[features/usuarios]]
- [[features/autenticacao]]
- [[rbac]]
