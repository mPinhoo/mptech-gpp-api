---
type: concept
tags: [seguranca, tecnico]
---

# Autenticação JWT

Sistema de autenticação baseado em **JSON Web Token** com expiração de **24 horas**.

## Regras de negócio

- Login rejeita usuário inativo ou senha incorreta
- Registro exige e-mail único; senha com bcrypt (cost 10)
- Admin hardcoded (`admin@mptech.com`) tem todas as permissões automaticamente
- Impersonação: admin pode operar como outro usuário ativo (exceto a si mesmo)
- Durante impersonação, `isAdmin: false` no payload retornado

## Regras técnicas

| Item | Detalhe |
|------|---------|
| Header | `Authorization: Bearer <token>` |
| Payload | `{ userId, email, impersonatedBy?, impersonatedByEmail? }` |
| Secret | `JWT_SECRET` (fallback inseguro: `'default-secret'`) |
| UI | Token em `localStorage`; `401` → logout automático |

## Rotas públicas (sem token)

- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/health`
- `GET /api/public/pedidos/:token`
- `POST /api/public/pedidos/:token/aceitar`

## Lacunas conhecidas

- Campos `resetTokenHash` e `resetTokenExpiresAt` existem no schema, mas **recuperação de senha não está implementada**
- UI tem `register` na API mas **não há página de registro**

## Relacionado

- [[rbac]]
- [[user]]
- [[features/autenticacao]]
- [[features/portal-publico]]
