import { AppError } from '../utils/errors.js';
import { loadWikiDocuments } from './wiki/wiki-loader.js';
import { formatDocumentsForPrompt, searchWiki } from './wiki/wiki-search.js';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  reply: string;
  sources: { title: string; category: string }[];
  mode: 'ai' | 'search';
}

const SYSTEM_PROMPT = `Você é o assistente de ajuda do sistema Zentra (GPP — Gestão de Pedidos e Produtos) da MPTech.

Regras:
- Responda SOMENTE com base na documentação fornecida abaixo.
- Se a informação não estiver na documentação, diga claramente que não encontrou essa informação na base de conhecimento.
- Responda sempre em português brasileiro, de forma clara, objetiva e amigável.
- Use passos numerados quando explicar procedimentos.
- Não invente funcionalidades, endpoints ou regras que não estejam na documentação.
- Se a pergunta for sobre permissões, explique qual menu/ação é necessária quando relevante.`;

async function callOpenAI(
  context: string,
  history: ChatMessage[],
  question: string
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AppError('OPENAI_API_KEY não configurada', 503, 'AI_UNAVAILABLE');
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const messages = [
    {
      role: 'system' as const,
      content: `${SYSTEM_PROMPT}\n\n## Documentação relevante\n\n${context}`,
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
      temperature: 0.3,
      max_tokens: 800,
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

function buildSearchFallback(question: string, context: string, sources: { title: string; category: string }[]): string {
  if (sources.length === 0) {
    return 'Não encontrei informações sobre isso na documentação do sistema. Tente reformular sua pergunta ou pergunte sobre pedidos, produtos, estoque, kanban, agenda ou permissões.';
  }

  return `Encontrei estas informações na documentação que podem ajudar:\n\n${context.slice(0, 2500)}\n\n---\n\nSe precisar de mais detalhes, pergunte de forma mais específica sobre: ${sources.map((s) => s.title).join(', ')}.`;
}

export class ChatService {
  async ask(message: string, history: ChatMessage[] = []): Promise<ChatResponse> {
    const documents = loadWikiDocuments();
    const relevant = searchWiki(documents, message);
    const context = formatDocumentsForPrompt(relevant);
    const sources = relevant.map((doc) => ({ title: doc.title, category: doc.category }));

    if (process.env.OPENAI_API_KEY) {
      try {
        const reply = await callOpenAI(context, history, message);
        return { reply, sources, mode: 'ai' };
      } catch (err) {
        if (err instanceof AppError && err.code === 'AI_UNAVAILABLE') {
          // fall through to search
        } else if (err instanceof AppError) {
          throw err;
        }
      }
    }

    const reply = buildSearchFallback(message, context, sources);
    return { reply, sources, mode: 'search' };
  }

  getStatus(): { aiEnabled: boolean; documentCount: number } {
    const documents = loadWikiDocuments();
    return {
      aiEnabled: Boolean(process.env.OPENAI_API_KEY),
      documentCount: documents.length,
    };
  }
}

export const chatService = new ChatService();
