---
type: feature
menu: produtos
tags: [funcionalidade]
---

# Produtos

Catálogo de produtos com BOM (lista de materiais) e precificação integrada.

## Rotas UI

| Rota | Permissão |
|------|-----------|
| `/produtos` | `produtos` leitura |
| `/produtos/novo` | `produtos` criar |
| `/produtos/[id]` | `produtos` editar |

## Endpoints API

| Método | Rota |
|--------|------|
| GET | `/api/produtos` |
| GET | `/api/produtos/:id` |
| POST | `/api/produtos` |
| PUT | `/api/produtos/:id` |
| DELETE | `/api/produtos/:id` |

## Regras de negócio

- Categorias: Festa, Brindes, Outros, Empresas
- Status: ATIVO, INATIVO, FORA_DE_CICLO
- Nome + categoria + preço > 0 obrigatórios
- BOM: matérias-primas do estoque com quantidade por unidade
- DELETE = soft (INATIVO)
- Status alterável inline na listagem (com permissão editar)
- Precificação em tempo real ([[precificacao-formulas]])
- Margem de lucro: slider 0–80%
- Botão "Usar preço sugerido"

## Regras técnicas

- Filtros: `status`, `search`, `nome`, `categoria`, paginação, ordenação
- Update substitui materiais se enviados no body
- Lógica de preço duplicada: `lib/precificacao.ts` + inline na page

## Relacionado

- [[produto]]
- [[materia-prima]]
- [[precificacao-formulas]]
- [[features/precificacao]]
- [[features/estoque]]
