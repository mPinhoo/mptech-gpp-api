---
type: concept
tags: [tecnico]
---

# Stack Técnico

## API (`mptech-gpp-api`)

| Camada | Tecnologia |
|--------|------------|
| Runtime | Node.js ≥ 22 |
| Linguagem | TypeScript |
| Framework | Express 5 |
| ORM | Prisma 6 |
| Banco | PostgreSQL |
| Auth | JWT + bcrypt |
| Validação | Zod |
| Testes | Jest + ts-jest |
| Dev | tsx (hot-reload) |

## UI (`mptech-gpp-prod-ui`)

| Camada | Tecnologia |
|--------|------------|
| Framework | Next.js 16.2.6 (App Router) |
| UI | React 19, TypeScript 5 |
| Estilo | Tailwind CSS 4 |
| Ícones | lucide-react |
| Gráficos | recharts |
| Tema | next-themes |
| Estado | React Context (sem Redux) |
| HTTP | fetch via ApiClient singleton |
| Package manager | pnpm |

## Variáveis de ambiente

### API

| Variável | Obrigatória | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Sim | — |
| `JWT_SECRET` | Sim | `'default-secret'` |
| `PORT` | Não | `3001` |
| `CORS_ORIGIN` | Não | `http://localhost:3000` |

### UI

| Variável | Default |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | `https://mptech-gpp-api.onrender.com/api` |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` |

## Scripts principais

**API:** `dev`, `build`, `start`, `migrate`, `seed`, `test`

**UI:** `pnpm dev`, `pnpm build`, `pnpm start`, `pnpm lint`

## Relacionado

- [[arquitetura]]
- [[autenticacao-jwt]]
