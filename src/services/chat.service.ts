import { AppError } from '../utils/errors.js';
import { loadWikiDocuments } from './wiki/wiki-loader.js';
import { formatDocumentsForPrompt, searchWiki } from './wiki/wiki-search.js';
import { formatUserGuideReply, matchUserGuide } from './wiki/wiki-user-guides.js';
import type { ChatUserContext } from './chat-query.service.js';
import { tryDirectDataQuery } from './chat-query-intent.js';
import { CHAT_TOOLS, executeChatTool } from './chat-tools.js';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  reply: string;
  sources: { title: string; category: string }[];
  mode: 'ai' | 'guide' | 'search' | 'query';
}

const SYSTEM_PROMPT = `Você é a assistente virtual do Zentra — sistema de gestão para negócios de personalização.

## Público
Usuários finais (NÃO desenvolvedores).

## Suas capacidades
1. **Consultas ao sistema** — use as ferramentas disponíveis para buscar dados reais (estoque, pedidos, clientes, faturamento).
2. **Ajuda com o sistema** — explique como usar menus e funcionalidades com base na documentação.

## Quando usar ferramentas
- Perguntas sobre dados do negócio (estoque baixo, pedidos do dia/semana/mês, clientes recorrentes, clientes inativos, faturamento) → SEMPRE use a ferramenta correspondente antes de responder.
- Perguntas de "como fazer" (criar pedido, cadastrar produto) → use a documentação, sem ferramentas.

## Formato para CONSULTAS (dados)
- Responda com números e listas claras
- Use **negrito** para destacar nomes, valores e totais
- Tom direto e amigável
- Se a lista for longa, mostre os principais e indique onde ver mais (ex.: menu **Pedidos**, **Estoque**, **Clientes**)
- Estoque = matérias-primas/insumos (não confundir com produtos cadastrados)

## Formato para AJUDA (procedimentos)
[Título curto]:

**Menu A → Menu B → Ação**

1. Passo com **negrito** nos botões/menus
2. ...

## Regras gerais
- NUNCA invente dados — só use o que as ferramentas retornarem
- NUNCA use rotas (/pedidos), APIs, código ou termos técnicos
- Traduza: Kanban → Área de Trabalho; PENDENTE → aguardando aprovação
- Tom amigável e direto em português do Brasil`;

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

async function callOpenAIWithTools(
  messages: OpenAIMessage[],
  userCtx: ChatUserContext
): Promise<{ reply: string; usedTools: boolean }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AppError('OPENAI_API_KEY não configurada', 503, 'AI_UNAVAILABLE');
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  let currentMessages = [...messages];
  let usedTools = false;

  for (let round = 0; round < 3; round++) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: currentMessages,
        tools: CHAT_TOOLS,
        tool_choice: 'auto',
        temperature: 0.3,
        max_tokens: 700,
      }),
    });

    if (!response.ok) {
      throw new AppError(
        `Erro ao consultar IA: ${response.status}`,
        502,
        'AI_ERROR'
      );
    }

    const data = (await response.json()) as {
      choices?: { message?: OpenAIMessage }[];
    };

    const assistantMessage = data.choices?.[0]?.message;
    if (!assistantMessage) {
      throw new AppError('Resposta vazia da IA', 502, 'AI_ERROR');
    }

    if (!assistantMessage.tool_calls?.length) {
      const reply = assistantMessage.content?.trim();
      if (!reply) {
        throw new AppError('Resposta vazia da IA', 502, 'AI_ERROR');
      }
      return { reply, usedTools };
    }

    usedTools = true;
    currentMessages.push(assistantMessage);

    for (const toolCall of assistantMessage.tool_calls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(toolCall.function.arguments || '{}');
      } catch {
        args = {};
      }

      const result = await executeChatTool(toolCall.function.name, args, userCtx);
      currentMessages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }
  }

  throw new AppError('Limite de consultas excedido', 502, 'AI_ERROR');
}

async function callOpenAI(
  context: string,
  history: ChatMessage[],
  question: string,
  guideHint?: string
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AppError('OPENAI_API_KEY não configurada', 503, 'AI_UNAVAILABLE');
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const guideSection = guideHint
    ? `\n\n## Guia sugerido (use como base, pode melhorar a redação)\n${guideHint}`
    : '';

  const messages = [
    {
      role: 'system' as const,
      content: `${SYSTEM_PROMPT}${guideSection}\n\n## Documentação de referência\n${context}`,
    },
    ...history.slice(-6).map((msg) => ({
      role: msg.role,
      content: msg.content,
    })),
    { role: 'user' as const, content: question },
  ];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.4,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    throw new AppError(
      `Erro ao consultar IA: ${response.status}`,
      502,
      'AI_ERROR'
    );
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };

  const reply = data.choices?.[0]?.message?.content?.trim();
  if (!reply) {
    throw new AppError('Resposta vazia da IA', 502, 'AI_ERROR');
  }

  return reply;
}

function buildGenericFallback(sources: { title: string }[]): string {
  if (sources.length === 0) {
    return 'Posso te ajudar de duas formas:\n\n**Consultas:**\n• "Quais materiais estão com estoque baixo?"\n• "Quantos pedidos tive esta semana?"\n• "Quais clientes são mais recorrentes?"\n\n**Ajuda:**\n• "Como crio um pedido?"\n• "Como acompanho a produção?"';
  }

  const topic = sources[0].title;
  return `Sobre **${topic}**, posso te guiar passo a passo. Me diga o que você quer fazer — por exemplo: criar, enviar, editar ou acompanhar.`;
}

function isLikelyHelpQuestion(message: string): boolean {
  return /como\s+(fa[cç]o|crio|cadastro|envio|uso|funciona)|passo\s+a\s+passo|onde\s+(fica|encontro|clico)/i.test(
    message
  );
}

export class ChatService {
  async ask(
    message: string,
    history: ChatMessage[] = [],
    userCtx?: ChatUserContext
  ): Promise<ChatResponse> {
    const guide = matchUserGuide(message);
    const guideReply = guide ? formatUserGuideReply(guide) : null;
    const guideSources = guide
      ? [{ title: guide.title, category: 'guide' }]
      : [];

    if (guideReply && !process.env.OPENAI_API_KEY) {
      return { reply: guideReply, sources: guideSources, mode: 'guide' };
    }

    // Consultas diretas por palavras-chave (rápido, funciona sem IA)
    if (userCtx && !isLikelyHelpQuestion(message) && !guideReply) {
      const directReply = await tryDirectDataQuery(message, userCtx);
      if (directReply) {
        return {
          reply: directReply,
          sources: [{ title: 'Consulta ao sistema', category: 'query' }],
          mode: 'query',
        };
      }
    }

    const documents = loadWikiDocuments();
    const relevant = searchWiki(documents, message);
    const context = formatDocumentsForPrompt(relevant);
    const sources = guideSources.length
      ? guideSources
      : relevant.map((doc) => ({ title: doc.title, category: doc.category }));

    if (process.env.OPENAI_API_KEY && userCtx) {
      try {
        const guideSection = guideReply
          ? `\n\n## Guia sugerido\n${guideReply}`
          : '';

        const messages: OpenAIMessage[] = [
          {
            role: 'system',
            content: `${SYSTEM_PROMPT}${guideSection}\n\n## Documentação de referência\n${context}`,
          },
          ...history.slice(-6).map((msg) => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
          })),
          { role: 'user', content: message },
        ];

        const { reply, usedTools } = await callOpenAIWithTools(messages, userCtx);

        return {
          reply,
          sources: usedTools
            ? [{ title: 'Consulta ao sistema', category: 'query' }]
            : sources,
          mode: usedTools ? 'query' : 'ai',
        };
      } catch (err) {
        if (err instanceof AppError && err.code === 'AI_UNAVAILABLE') {
          // fall through
        } else if (err instanceof AppError) {
          throw err;
        }
      }
    }

    if (process.env.OPENAI_API_KEY && !userCtx) {
      try {
        const reply = await callOpenAI(context, history, message, guideReply ?? undefined);
        return { reply, sources, mode: 'ai' };
      } catch (err) {
        if (err instanceof AppError && err.code === 'AI_UNAVAILABLE') {
          // fall through
        } else if (err instanceof AppError) {
          throw err;
        }
      }
    }

    if (guideReply) {
      return { reply: guideReply, sources: guideSources, mode: 'guide' };
    }

    if (userCtx && !isLikelyHelpQuestion(message)) {
      return {
        reply:
          'Para consultas ao sistema, tente perguntar de forma direta:\n\n• "Quais materiais estão com estoque baixo?"\n• "Quantos pedidos tive esta semana?"\n• "Quais clientes não pedem há 30 dias?"\n\nPara ajuda com o sistema, pergunte "Como faço..."',
        sources: [],
        mode: 'search',
      };
    }

    const reply = buildGenericFallback(sources);
    return { reply, sources, mode: 'search' };
  }

  getStatus(): { aiEnabled: boolean; documentCount: number; queriesEnabled: boolean } {
    const documents = loadWikiDocuments();
    return {
      aiEnabled: Boolean(process.env.OPENAI_API_KEY),
      documentCount: documents.length,
      queriesEnabled: true,
    };
  }
}

export const chatService = new ChatService();
