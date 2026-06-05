---
type: concept
tags: [seguranca, negocio]
---

# RBAC — Controle de Acesso por Menu

Sistema de **grupos de permissão** com 10 menus e 3 ações cada.

## Menus

| Key | Label |
|-----|-------|
| `home` | Home / Dashboard |
| `agenda` | Agenda |
| `pedidos` | Pedidos |
| `area_trabalho` | Área de Trabalho (Kanban) |
| `produtos` | Produtos |
| `clientes` | Clientes |
| `estoque` | Estoque |
| `precificacao` | Precificação |
| `administrativo_usuarios` | Administrativo · Usuários |
| `administrativo_permissoes` | Administrativo · Permissões |

## Ações

- `leitura` — visualizar
- `criar` — criar novos registros
- `editar` — editar/excluir

## Regras de negócio

- Usuário sem grupo recebe permissões vazias
- Admin (`admin@mptech.com`) ignora RBAC — acesso total
- Grupo sistema (`sistema: true`) não pode ser excluído
- Grupo em uso (com usuários) não pode ser excluído
- Desmarcar `leitura` na UI desmarca `criar` e `editar`; marcar `criar`/`editar` marca `leitura`

## Regras técnicas

- `permissionMiddleware` mapeia método HTTP + path → menu + ação
- `mergePermissoes` garante todos os 10 menus na resposta
- UI: rotas `*/novo` exigem `criar`; rotas `*/[id]` exigem `editar`
- `/perfil` sempre acessível (bypass RBAC)

## Relacionado

- [[grupo-permissao]]
- [[user]]
- [[features/permissoes]]
- [[features/usuarios]]
