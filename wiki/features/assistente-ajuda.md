---
type: feature
menu: home
tags: [funcionalidade, chatbot]
---

# Assistente de Ajuda (Chatbot)

Widget flutuante que responde dúvidas sobre o sistema com base na wiki de documentação.

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
- Responde com base na documentação da wiki (regras, funcionalidades, fluxos)
- Com `OPENAI_API_KEY` configurada: respostas em linguagem natural via IA
- Sem chave de IA: busca por palavras-chave na wiki e retorna trechos relevantes
- Não responde sobre dados específicos do tenant (pedidos, clientes do usuário)

## Regras técnicas

- Wiki carregada de `wiki/` na API ou `WIKI_PATH` env
- Busca: tokenização + scoring por relevância (top 6 documentos)
- Modelo padrão: `gpt-4o-mini` (configurável via `OPENAI_MODEL`)
- Histórico: últimas 6 mensagens enviadas ao LLM
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
