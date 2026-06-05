---
type: concept
tags: [tecnico, indice]
---

# Regras Técnicas — Índice

Compilação das principais regras técnicas e convenções do GPP.

## API

- Padrão REST com prefixo `/api`
- Resposta envelope: `{ success, data, meta? }`
- Erros tipados: 401, 403, 404, 409, 422 via `AppError`
- Validação de entrada com Zod nos schemas
- Express 5: `validate` middleware não reatribui `req.query`

## Autenticação

- JWT Bearer, 24h de expiração ([[autenticacao-jwt]])
- `permissionMiddleware` em rotas protegidas

## Banco de dados

- PostgreSQL com Prisma ORM
- Extensão `pg_trgm` para busca fuzzy de clientes (threshold 0.25)
- Timezone de negócio: `America/Sao_Paulo` (`datetime-br.ts`)
- 15 migrations

## Jobs

- Intervalo: 60 segundos
- Lembretes: processa até 50 por ciclo
- Iniciados em `server.ts` junto com HTTP

## UI

- App Router Next.js 16
- Token em `localStorage`
- Polling de notificações: 30s
- Debounce de buscas: 400ms (dashboard), 1s (filtros)
- Avatar: data-URI base64, máx 1,5 MB

## Testes (API)

Cobertura em `tests/unit/` para services, middlewares e utils principais.

## Lacunas conhecidas

| Item | Status |
|------|--------|
| Reset de senha | Schema pronto, API não implementada |
| `GET /dashboard/chart` | Existe na API, não usado na UI |
| `POST /estoque/saida` | Existe na API, sem tela na UI |
| `register` | API ok, sem página na UI |
| README da API | Desatualizado vs código |

## Relacionado

- [[regras-de-negocio]]
- [[stack-tecnico]]
- [[arquitetura]]
