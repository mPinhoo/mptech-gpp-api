---
type: source
title: Análise do código — mptech-gpp-api
date: 2026-06-05
tags: [fonte, codigo]
raw_file: ../mptech-gpp-api
---

# Análise do código — mptech-gpp-api

Documentação gerada por análise estática do repositório backend em 2026-06-05.

## Resumo

API REST Node.js/Express 5 com Prisma/PostgreSQL. 70+ endpoints em 13 módulos. Multi-tenant por `userId`. JWT + RBAC por menus. Jobs de lembretes e alertas de prazo a cada 60s.

## Pontos-chave

- Entry: `src/server.ts` → `src/app.ts`
- Padrão: Route → Middleware → Controller → Service → Prisma
- README desatualizado — usar wiki como fonte de verdade
- Seed mínimo: admin `admin@mptech.com` / `senha123`
- Reset de senha: schema pronto, endpoints ausentes

## Entidades relacionadas

- [[user]], [[pedido]], [[produto]], [[cliente]], [[materia-prima]], [[grupo-permissao]], [[notificacao]], [[lembrete]]

## Conceitos relacionados

- [[arquitetura]], [[multi-tenancy]], [[autenticacao-jwt]], [[rbac]], [[regras-tecnicas]]

## Perguntas em aberto

- Ver [[questions/lacunas-conhecidas]]
