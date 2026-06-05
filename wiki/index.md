# MPTech GPP / Zentra — Wiki

Base de conhecimento do sistema de **Gestão de Pedidos e Produtos**.

## Repositórios

| Repo | Descrição |
|------|-----------|
| `../mptech-gpp-api` | Backend REST (Express + Prisma) |
| `../mptech-gpp-prod-ui` | Frontend (Next.js — Zentra) |
| `.` | Esta wiki (Obsidian vault) |

---

## Funcionalidades

| Módulo | Página | Menu RBAC |
|--------|--------|-----------|
| Autenticação e Perfil | [[features/autenticacao]] | — |
| Dashboard | [[features/dashboard]] | `home` |
| Notificações | [[features/notificacoes]] | `home` |
| Agenda | [[features/agenda]] | `agenda` |
| Pedidos | [[features/pedidos]] | `pedidos` |
| Portal Público | [[features/portal-publico]] | — |
| Área de Trabalho (Kanban) | [[features/kanban]] | `area_trabalho` |
| Produtos | [[features/produtos]] | `produtos` |
| Precificação | [[features/precificacao]] | `precificacao` |
| Estoque | [[features/estoque]] | `estoque` |
| Clientes | [[features/clientes]] | `clientes` |
| Usuários | [[features/usuarios]] | `administrativo_usuarios` |
| Permissões | [[features/permissoes]] | `administrativo_permissoes` |
| Assistente de Ajuda | [[features/assistente-ajuda]] | autenticado |

---

## Conceitos

### Arquitetura e técnico
- [[concepts/arquitetura]]
- [[concepts/stack-tecnico]]
- [[concepts/multi-tenancy]]
- [[concepts/autenticacao-jwt]]
- [[concepts/rbac]]
- [[concepts/regras-tecnicas]]

### Negócio
- [[concepts/regras-de-negocio]]
- [[concepts/ciclo-vida-pedido]]
- [[concepts/precificacao-formulas]]
- [[concepts/alertas-prazo]]

---

## Entidades

- [[entities/user]]
- [[entities/grupo-permissao]]
- [[entities/cliente]]
- [[entities/produto]]
- [[entities/materia-prima]]
- [[entities/pedido]]
- [[entities/notificacao]]
- [[entities/lembrete]]

---

## Sources

- [[sources/analise-codigo-api]]
- [[sources/analise-codigo-ui]]

---

## Questions

- [[questions/lacunas-conhecidas]]
