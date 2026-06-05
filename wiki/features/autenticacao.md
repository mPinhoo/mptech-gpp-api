---
type: feature
menu: auth
tags: [funcionalidade]
---

# Autenticação e Perfil

Login, sessão JWT, perfil do usuário e impersonação administrativa.

## Rotas UI

| Rota | Descrição |
|------|-----------|
| `/login` | Login e-mail/senha |
| `/perfil` | Editar nome, avatar, senha (sempre acessível) |

## Endpoints API

| Método | Rota | Auth |
|--------|------|------|
| POST | `/api/auth/login` | Não |
| POST | `/api/auth/register` | Não |
| GET | `/api/auth/me` | Sim |
| PUT | `/api/auth/profile` | Sim |
| POST | `/api/auth/stop-impersonate` | Sim |

## Regras de negócio

- Senha mínima 6 caracteres na UI
- "Lembre-se de mim" salva e-mail em `localStorage` (`zentra-remember-email`)
- Avatar: JPEG/PNG/GIF/WebP, máx 1,5 MB como data URL
- Troca de senha exige senha atual
- E-mail no perfil é somente leitura
- Login redireciona para primeira rota permitida pelo RBAC
- Impersonação: só admin real, alvo ativo, não pode impersonar a si

## Regras técnicas

- Token JWT em `localStorage` (`token`)
- `AuthProvider` valida com `GET /auth/me` no mount
- `401` em qualquer request → remove token + redirect `/login`
- Rotas públicas no guard: `/login`, `/pedido/*`
- Banner amarelo durante impersonação com botão "Voltar ao admin"

## Arquivos principais

**API:** `auth.service.ts`, `auth.controller.ts`, `auth.routes.ts`, `middlewares/auth.ts`

**UI:** `AuthProvider.tsx`, `UserMenu.tsx`, `ImpersonationBanner.tsx`, `app/login/page.tsx`, `app/(dashboard)/perfil/page.tsx`

## Relacionado

- [[autenticacao-jwt]]
- [[rbac]]
- [[user]]
- [[features/usuarios]]
