---
type: question
tags: [lacunas]
---

# Lacunas Conhecidas

Perguntas e itens pendentes identificados na análise do código.

## Funcionalidades incompletas

- [ ] **Reset de senha** — campos no schema Prisma, sem endpoints API nem UI
- [ ] **Registro de usuário** — API `POST /auth/register` existe, sem página na UI
- [ ] **Saída de estoque** — API `POST /estoque/saida` existe, sem tela
- [ ] **Gráfico do dashboard** — API `GET /dashboard/chart` existe, não usado na Home

## Inconsistências

- [ ] Dashboard stats filtra faturamento por `dataPedido`; chart por `createdAt`
- [ ] Lógica de precificação duplicada: `lib/precificacao.ts` vs inline nas pages de produto
- [ ] README da API desatualizado vs código real

## Melhorias sugeridas

- [ ] Gerar OpenAPI/Swagger a partir dos endpoints
- [ ] Unificar cálculo de precificação em um único módulo na UI
- [ ] Documentar domínio GPP no README dos repositórios

## Relacionado

- [[regras-tecnicas]]
- [[sources/analise-codigo-api]]
- [[sources/analise-codigo-ui]]
