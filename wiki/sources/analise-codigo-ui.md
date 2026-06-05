---
type: source
title: Análise do código — mptech-gpp-prod-ui
date: 2026-06-05
tags: [fonte, codigo]
raw_file: ../mptech-gpp-prod-ui
---

# Análise do código — mptech-gpp-prod-ui

Documentação gerada por análise estática do repositório frontend em 2026-06-05.

## Resumo

App Next.js 16 (App Router) com marca **Zentra**. React 19, Tailwind 4, Context API para estado. 16 rotas autenticadas + login + portal público. Integração REST via `api.ts` singleton.

## Pontos-chave

- Providers globais: Theme, Auth, Notifications, Sidebar, PageTitle
- RBAC espelha API com `permissions.ts`
- README é boilerplate create-next-app — não documenta domínio
- Lacunas: sem página register, sem saída de estoque, chart não usado

## Funcionalidades mapeadas

- [[features/autenticacao]] até [[features/permissoes]] — 13 módulos

## Conceitos relacionados

- [[stack-tecnico]], [[rbac]], [[precificacao-formulas]]

## Perguntas em aberto

- Ver [[questions/lacunas-conhecidas]]
