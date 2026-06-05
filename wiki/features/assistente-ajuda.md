---
type: feature
menu: home
tags: [funcionalidade, chatbot]
---

# Assistente de Ajuda (Chatbot)

Widget flutuante que responde dúvidas sobre o sistema com base na wiki de documentação.

## Separação wiki × chat

| Camada | Público | Linguagem |
|--------|---------|-----------|
| **Wiki** (`mptech-gpp-wiki`) | Desenvolvedores, agentes, Obsidian | Técnica (endpoints, arquitetura, código) |
| **Chat** (widget no app) | Usuários finais do Zentra | Simples (menus, passos, dia a dia) |

A wiki **não é simplificada**. O chat usa `wiki-simplify.ts` para filtrar/traduzir o contexto antes de responder.

## Rotas UI

- Widget FAB fixo em todas as telas autenticadas (`/home`, `/pedidos`, etc.)
- Botão no canto inferior direito (ícone de mensagem)

## Endpoints API

| Método | Rota | Auth |
|--------|------|------|
| GET | `/api/chat/status` | Sim |
| POST | `/api/chat` | Sim |

## Body do POST /chat

```json
{
  "message": "Como criar um pedido?",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

## Regras de negócio

- Disponível para **qualquer usuário autenticado**
- Respostas em linguagem de usuário — sem endpoints, código ou jargão técnico
- **Consultas ao sistema** com períodos flexíveis: hoje, semana, mês, mês passado, ano, últimos N dias, até hoje, intervalo personalizado
- Pedidos por status (pendente, aprovado, concluído, cancelado) com resumo
- Total de clientes, recorrentes e inativos
- Estoque de insumos (baixo, crítico, normal)
- Produtos mais/menos vendidos; entradas e consumo de materiais
- Consultas respeitam **permissões RBAC** (estoque, pedidos, clientes, produtos, home)
- Com `OPENAI_API_KEY`: IA interpreta perguntas livres e chama ferramentas automaticamente
- Sem chave de IA: consultas por palavras-chave + guias da wiki
- Perguntas de "como fazer" continuam usando documentação/guia

## Regras técnicas

- Wiki carregada de `wiki/` na API ou `WIKI_PATH` env (conteúdo inalterado)
- `wiki-simplify.ts`: remove seções técnicas do contexto enviado ao chat
- Busca prioriza `wiki/features/`; penaliza arquitetura, stack, análise de código
- System prompt proíbe linguagem de desenvolvedor nas respostas
- Modelo padrão: `gpt-4o-mini` (`OPENAI_MODEL`)
- Sincronizar wiki: `npm run sync-wiki` na API

## Variáveis de ambiente (API)

| Variável | Descrição |
|----------|-----------|
| `OPENAI_API_KEY` | Chave OpenAI (opcional; sem ela usa modo busca) |
| `OPENAI_MODEL` | Modelo (default: gpt-4o-mini) |
| `WIKI_PATH` | Caminho customizado para pasta wiki |

## Relacionado

- [[concepts/arquitetura]]
- [[concepts/regras-de-negocio]]
- [[features/autenticacao]]
