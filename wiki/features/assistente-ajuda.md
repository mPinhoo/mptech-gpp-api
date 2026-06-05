---
type: feature
menu: home
tags: [funcionalidade, chatbot, consultas]
---

# Assistente de Ajuda (Chatbot)

Widget flutuante (**Assistente Zentra**) com duas capacidades:

1. **Consultas ao sistema** — dados reais do tenant (pedidos, faturamento, clientes, estoque, produtos)
2. **Ajuda** — passos para usar o Zentra (wiki + guias curados)

## Separação wiki × chat

| Camada | Público | Linguagem |
|--------|---------|-----------|
| **Wiki** (`mptech-gpp-wiki`) | Desenvolvedores, agentes, Obsidian | Técnica (endpoints, arquitetura, código) |
| **Chat** (widget no app) | Usuários finais do Zentra | Simples (menus, passos, dia a dia) |

A wiki **não é simplificada** para o chat. O serviço `wiki-simplify.ts` filtra seções técnicas antes de enviar contexto à IA.

---

## Rotas UI

| Item | Detalhe |
|------|---------|
| Componente | `HelpChatWidget.tsx` |
| Posição | FAB fixo, canto inferior direito |
| Telas | Todas autenticadas (`/home`, `/pedidos`, etc.) |
| Histórico | Últimas 8 mensagens enviadas à API |

---

## Endpoints API

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/api/chat/status` | Sim | Status da IA e consultas |
| POST | `/api/chat` | Sim | Pergunta + histórico |

### GET /chat/status — resposta

```json
{
  "success": true,
  "data": {
    "aiEnabled": true,
    "documentCount": 42,
    "queriesEnabled": true
  }
}
```

### POST /chat — body

```json
{
  "message": "Qual o faturamento da última semana?",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

### POST /chat — resposta

```json
{
  "success": true,
  "data": {
    "reply": "Faturamento na última semana...",
    "sources": [{ "title": "Consulta ao sistema", "category": "query" }],
    "mode": "query"
  }
}
```

| `mode` | Significado |
|--------|-------------|
| `query` | Resposta baseada em consulta ao banco (ferramentas) |
| `ai` | Resposta da IA com documentação (sem ferramentas) |
| `guide` | Guia passo a passo curado (`wiki-user-guides.ts`) |
| `search` | Fallback genérico (wiki ou sugestões) |

---

## Arquitetura (código)

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/services/chat.service.ts` | Orquestra IA, guias, consultas e fallback |
| `src/services/chat-tools.ts` | Definições OpenAI Function Calling + executor |
| `src/services/chat-query.service.ts` | Consultas Prisma ao banco do tenant |
| `src/services/chat-query-intent.ts` | Detecção por palavras-chave (sem IA) + formatação |
| `src/utils/chat-period.ts` | Resolução de períodos (hoje, semana, N dias...) |
| `src/services/wiki/wiki-user-guides.ts` | Guias "como fazer" para usuários finais |
| `src/services/wiki/wiki-search.ts` | Busca na wiki para perguntas de ajuda |
| `src/controllers/chat.controller.ts` | Passa `userId` e `email` do JWT para o serviço |

### Fluxo com IA (`OPENAI_API_KEY`)

```
Pergunta → chat.service
  → isDataQuestion? → OpenAI + CHAT_TOOLS (até 5 rodadas)
    → executeChatTool → chat-query.service → Prisma
  → isHelpQuestion? → OpenAI + contexto wiki/guias
```

### Fluxo sem IA

```
Pergunta → matchUserGuide (como fazer)
        → matchDataQuery + tryDirectDataQuery (palavras-chave)
        → busca wiki genérica
```

---

## Períodos suportados

Resolvidos em `chat-period.ts` (`resolveChatPeriodo`). Fuso: **America/Sao_Paulo**.

| Preset | Descrição | Exemplo de pergunta |
|--------|-----------|---------------------|
| `hoje` | Dia atual | "pedidos de hoje" |
| `semana` | Últimos 7 dias (inclui hoje) | "faturamento da última semana" |
| `mes` | 1º dia do mês atual até hoje | "pedidos deste mês" |
| `mes_passado` | Mês calendário anterior completo | "faturamento do mês passado" |
| `ano` | Últimos 365 dias | "faturamento do último ano" |
| `ultimos_n_dias` | N dias (1–365), parâmetro `dias` | "últimos 10 dias" |
| `ultimos_30_dias` | Atalho para 30 dias | — |
| `ate_hoje` | Todo histórico (`start = null`) | "quantos pedidos fiz até hoje" |
| `personalizado` | `data_de` + `data_ate` (YYYY-MM-DD) | "de 01/03 a 15/03" |

Parâmetros comuns nas ferramentas: `periodo`, `dias`, `data_de`, `data_ate`.

---

## Ferramentas (Function Calling)

Definidas em `CHAT_TOOLS` (`chat-tools.ts`). Cada consulta filtra por **`userId`** do JWT (isolamento por tenant).

### 1. `consultar_pedidos`

**Permissão:** `pedidos` leitura

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `periodo`, `dias`, `data_de`, `data_ate` | período | Ver tabela acima |
| `status` | `PENDENTE` \| `APROVADO` \| `CONCLUIDO` \| `CANCELADO` | Filtro opcional |
| `incluir_resumo_status` | boolean | Contagem por status (padrão `true`) |

**Dados retornados:**

| Campo | Fonte / regra |
|-------|---------------|
| `periodo` | Label do período |
| `total` | `COUNT` pedidos no período (`dataPedido`) |
| `valorTotal` | Soma `valorTotal` de todos os status no período |
| `statusFiltro` | Status aplicado, se houver |
| `porStatus[]` | `{ status, quantidade }` — groupBy status |
| `pedidos[]` | Até **15** mais recentes: `numero`, `cliente`, `data`, `valor`, `status` |

**Filtro de data:** campo `Pedido.dataPedido`.

---

### 2. `consultar_faturamento`

**Permissão:** `home` leitura

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `periodo`, `dias`, `data_de`, `data_ate` | período | Ver tabela acima |
| `incluir_despesas` | boolean | Se `true`, inclui despesas e saldo |

**Dados retornados:**

| Campo | Fonte / regra |
|-------|---------------|
| `periodo`, `dataDe`, `dataAte` | Intervalo consultado |
| `faturamento` | Soma `valorTotal` pedidos **APROVADO** + **CONCLUIDO** |
| `pedidosFaturados` | Quantidade desses pedidos |
| `ticketMedio` | `faturamento / pedidosFaturados` |
| `totalPedidosNoPeriodo` | Todos os pedidos no período (qualquer status) |
| `detalhePorStatus[]` | `{ status, quantidade, valor }` por Aprovado/Concluído |
| `despesas` | Soma `Despesa.valor` por `createdAt` (se `incluir_despesas`) |
| `saldo` | `faturamento - despesas` |
| `regra` | Texto explicativo da regra de faturamento |

**Filtro de data (faturamento):** `Pedido.dataPedido`  
**Filtro de data (despesas):** `Despesa.createdAt`

> Mesma regra do [[features/dashboard]]: faturamento = pedidos Aprovados + Concluídos.

---

### 3. `consultar_resumo_financeiro`

**Permissão:** `home` leitura

Equivalente a `consultar_faturamento` com `incluir_despesas: true` sempre.  
Use quando o usuário pedir **resumo completo** (faturamento + despesas + saldo).

---

### 4. `consultar_clientes`

**Permissão:** `clientes` leitura

| Parâmetro | `tipo` | Outros |
|-----------|--------|--------|
| `total` | Contagem na base | — |
| `recorrentes` | Ranking por pedidos | `limite` (padrão 10), `periodo_meses` (padrão 12) |
| `inativos` | Sem pedir há X dias | `dias_sem_pedir` (padrão 30), `limite` (padrão 20) |

**`tipo: total` — dados:**

| Campo | Regra |
|-------|-------|
| `ativos` | `Cliente.ativo = true` |
| `inativos` | `Cliente.ativo = false` |
| `comPedido` | Ativos com ≥1 pedido |
| `semPedido` | Ativos sem nenhum pedido |
| `totalGeral` | ativos + inativos |

**`tipo: recorrentes` — dados:**

| Campo | Regra |
|-------|-------|
| `clientes[]` | `nome`, `telefone`, `totalPedidos`, `valorTotal` |
| Janela | Últimos `periodo_meses × 30` dias |
| Exclusão | Pedidos `CANCELADO` não entram |
| Ordenação | Mais pedidos primeiro |

**`tipo: inativos` — dados:**

| Campo | Regra |
|-------|-------|
| `clientesSemPedidoRecente[]` | Último pedido antes do threshold; `diasSemPedir` calculado |
| `clientesNuncaPediram[]` | Ativos sem nenhum pedido |
| Threshold | `dias_sem_pedir` dias atrás |
| SQL | `MAX(dataPedido) < threshold`, exclui cancelados |

---

### 5. `consultar_estoque`

**Permissão:** `estoque` leitura

| Parâmetro `filtro` | Resultado |
|--------------------|-----------|
| `baixo_ou_critico` | Baixo + Crítico (padrão) |
| `baixo` | Só Baixo |
| `critico` | Só Crítico |
| `normal` | Só Normal |
| `todos` | Todos os itens |

**Entidade:** `MateriaPrima` (insumos — **não** produtos cadastrados)

**Cálculo de status** (`MARGEM_ESTOQUE_BAIXO = 31`):

| Status | Condição |
|--------|----------|
| Crítico | `quantidade < quantidadeMinima` |
| Baixo | `quantidade >= mínimo` E `quantidade <= mínimo + 31` |
| Normal | `quantidade > mínimo + 31` |

**Dados retornados:** `total`, `criticos`, `baixos`, `itens[]` (`nome`, `quantidade`, `minimo`, `unidade`, `status`)

> Se o usuário perguntar "produtos com estoque baixo", o bot consulta insumos e explica a diferença.

---

### 6. `consultar_produtos`

**Permissão:** `produtos` leitura

| `tipo` | Descrição |
|--------|-----------|
| `total` | Contagem por status (`ATIVO`, `INATIVO`, `FORA_DE_CICLO`) |
| `mais_vendidos` | Ranking por `SUM(ItemPedido.quantidade)` no período |
| `menos_vendidos` | Mesmo ranking, ordem ascendente |

**Vendas:** pedidos com `status != CANCELADO`, filtro por `Pedido.dataPedido`.  
**Dados:** `nome`, `categoria`, `quantidadeVendida` (até `limite`, padrão 10).

---

### 7. `consultar_materiais_movimentacao`

**Permissão:** `estoque` leitura

| `tipo` | Fonte dos dados |
|--------|-----------------|
| `entradas` | `Despesa` com `descricao` iniciando em `"Entrada estoque:"` e `materiaPrimaId` |
| `consumo` | Estimativa: pedidos APROVADO/CONCLUIDO → `ItemPedido` → `MaterialProduto` × quantidade |

| Parâmetro | Descrição |
|-----------|-----------|
| `ordenar` | `mais` ou `menos` (padrão `mais`) |
| `limite` | Padrão 10 materiais |

**Entradas:** agrupa por `materiaPrimaId`, extrai quantidade do padrão `(xN)` na descrição.  
**Consumo:** soma `MaterialProduto.quantidade × ItemPedido.quantidade` por insumo.

---

## Permissões RBAC

| Ferramenta | Menu | Ação |
|------------|------|------|
| `consultar_pedidos` | `pedidos` | leitura |
| `consultar_clientes` | `clientes` | leitura |
| `consultar_estoque` | `estoque` | leitura |
| `consultar_produtos` | `produtos` | leitura |
| `consultar_materiais_movimentacao` | `estoque` | leitura |
| `consultar_faturamento` | `home` | leitura |
| `consultar_resumo_financeiro` | `home` | leitura |

Rota `/api/chat` não tem regra explícita no `permission.middleware` — qualquer autenticado pode usar o chat; **cada ferramenta** valida permissão individualmente via `userCan()`.

Sem permissão: retorno `{ error: "Você não tem permissão..." }` — a IA repassa ao usuário.

---

## Modelos Prisma consultados

| Modelo | Consultas |
|--------|-----------|
| `Pedido` | pedidos, faturamento, recorrentes, inativos |
| `Cliente` | total, recorrentes, inativos |
| `MateriaPrima` | estoque |
| `Produto` | total cadastrados, ranking vendas |
| `ItemPedido` | produtos mais/menos vendidos |
| `MaterialProduto` | consumo de insumos |
| `Despesa` | entradas de estoque, despesas no resumo financeiro |

---

## Guias de ajuda (sem consulta ao banco)

Fonte: `wiki-user-guides.ts` — ativados por palavras-chave em perguntas "como fazer".

| ID | Título |
|----|--------|
| `criar-pedido` | Como criar um pedido |
| `enviar-pedido` | Como enviar o pedido para o cliente |
| `producao-kanban` | Como acompanhar a produção |
| `cadastrar-produto` | Como cadastrar um produto |
| `cadastrar-cliente` | Como cadastrar um cliente |
| `estoque-entrada` | Como dar entrada no estoque (inclui keywords "estoque baixo") |
| `agenda-lembrete` | Como criar lembrete na agenda |
| `precificacao` | Como usar a precificação |

---

## Exemplos de perguntas

### Consultas (ferramentas)

- "Qual o faturamento da última semana?"
- "Quanto faturei nos últimos 15 dias?"
- "Faturamento e despesas do mês"
- "Quantos pedidos aprovados até hoje?"
- "Pedidos do mês passado por status"
- "Quantos clientes temos na base?"
- "Clientes que não pedem há 60 dias"
- "Quais clientes são mais recorrentes?"
- "Quais insumos estão com estoque crítico?"
- "Produtos mais vendidos no último mês"
- "Materiais com mais entrada nos últimos 30 dias"

### Ajuda (guias/wiki)

- "Como faço um novo pedido?"
- "Como acompanho a produção?"
- "Como cadastro um produto?"

---

## Regras de negócio gerais

- Disponível para **qualquer usuário autenticado**
- Dados sempre filtrados pelo **`userId`** do token JWT
- Respostas ao usuário **sem** endpoints, código ou jargão técnico
- A IA **nunca inventa dados** — só responde com retorno das ferramentas
- Com `OPENAI_API_KEY`: perguntas livres → IA escolhe ferramenta e período
- Sem `OPENAI_API_KEY`: consultas limitadas a `chat-query-intent.ts` (palavras-chave)
- Perguntas "como fazer" **não** disparam ferramentas de consulta
- Listas longas truncadas no backend (ex.: 15 pedidos, 10 clientes/produtos) — bot indica menu para ver mais

---

## Regras técnicas

- Wiki carregada de `wiki/` na API ou `WIKI_PATH` env
- `wiki-simplify.ts`: remove seções técnicas do contexto enviado ao chat
- Busca wiki prioriza `wiki/features/`; penaliza arquitetura e stack
- Modelo padrão: `gpt-4o-mini` (`OPENAI_MODEL`)
- OpenAI: até **5 rodadas** de tool calling por pergunta
- Histórico enviado à IA: últimas **8** mensagens
- `max_tokens`: 1000 (com ferramentas)
- Sincronizar wiki: `npm run sync-wiki` na API

---

## Variáveis de ambiente (API)

| Variável | Descrição |
|----------|-----------|
| `OPENAI_API_KEY` | Chave OpenAI — **necessária para perguntas livres** |
| `OPENAI_MODEL` | Modelo (default: `gpt-4o-mini`) |
| `WIKI_PATH` | Caminho customizado para pasta wiki |

---

## Limitações conhecidas

| Tema | Limitação |
|------|-----------|
| Estoque vs produtos | Estoque = `MateriaPrima`; produtos cadastrados são outra entidade |
| Saída de insumos | Sem log de saída manual; consumo é **estimado** via pedidos |
| Saída de produtos | Proxy = quantidade vendida em `ItemPedido` |
| Despesas no faturamento | Filtradas por `createdAt`, não por `dataPedido` |
| Ações de escrita | Bot **não cria** pedidos, clientes ou registros — só consulta |
| Dados de outros tenants | Isolamento por `userId`; não cruza contas |

---

## Relacionado

- [[features/dashboard]] — mesma regra de faturamento
- [[features/pedidos]]
- [[features/clientes]]
- [[features/estoque]]
- [[features/produtos]]
- [[concepts/arquitetura]]
- [[concepts/regras-de-negocio]]
- [[features/autenticacao]]
