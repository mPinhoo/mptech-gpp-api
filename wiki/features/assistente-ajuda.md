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
- Com `OPENAI_API_KEY`: IA traduz documentação técnica em respostas amigáveis
- Sem chave de IA: extrai "onde fazer" + "como funciona" das páginas de funcionalidade
- Não responde sobre dados específicos do tenant (pedidos, clientes do usuário)

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
