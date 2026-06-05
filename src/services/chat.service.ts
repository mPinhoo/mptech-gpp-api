import { AppError } from '../utils/errors.js';
import { loadWikiDocuments } from './wiki/wiki-loader.js';
import { formatDocumentsForPrompt, searchWiki } from './wiki/wiki-search.js';
import { formatUserGuideReply, matchUserGuide } from './wiki/wiki-user-guides.js';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  reply: string;
  sources: { title: string; category: string }[];
  mode: 'ai' | 'guide' | 'search';
}

const SYSTEM_PROMPT = `Você é a assistente virtual do Zentra — sistema de gestão para negócios de personalização.

## Público
Usuários finais (NÃO desenvolvedores).

## Formato OBRIGATÓRIO da resposta
Sempre use este formato para procedimentos:

[Título curto]:

**Menu A → Menu B → Ação → Ação → Ação**

1. Passo claro com **negrito** nos botões/menus
2. Próximo passo
3. ...

## Exemplo perfeito
Pergunta: "Como crio um pedido?"
Resposta:
"Para criar um pedido:

**Pedidos → Novo Pedido → Selecionar cliente e produtos → Salvar → Enviar para o cliente**

1. No menu lateral, clique em **Pedidos**
2. Clique em **Novo Pedido**
3. Escolha o cliente e adicione os produtos
4. Clique em **Salvar**
5. Para o cliente aprovar, clique em **Enviar para o Cliente**"

## Regras
- NUNCA use tabelas markdown, rotas (/pedidos), APIs, código ou termos técnicos
- Traduza: Kanban → Área de Trabalho; PENDENTE → aguardando aprovação
- Máximo 5-7 passos
- Tom amigável e direto`;

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
    return 'Não encontrei isso no manual. Tente perguntar de forma direta, por exemplo:\n\n• "Como crio um pedido?"\n• "Como acompanho a produção?"\n• "Como cadastro um produto?"';
  }

  const topic = sources[0].title;
  return `Sobre **${topic}**, posso te guiar passo a passo. Me diga o que você quer fazer — por exemplo: criar, enviar, editar ou acompanhar.`;
}

export class ChatService {
  async ask(message: string, history: ChatMessage[] = []): Promise<ChatResponse> {
    const guide = matchUserGuide(message);
    const guideReply = guide ? formatUserGuideReply(guide) : null;
    const guideSources = guide
      ? [{ title: guide.title, category: 'guide' }]
      : [];

    // Guias curados: resposta direta e clara (com ou sem IA)
    if (guideReply && !process.env.OPENAI_API_KEY) {
      return { reply: guideReply, sources: guideSources, mode: 'guide' };
    }

    const documents = loadWikiDocuments();
    const relevant = searchWiki(documents, message);
    const context = formatDocumentsForPrompt(relevant);
    const sources = guideSources.length
      ? guideSources
      : relevant.map((doc) => ({ title: doc.title, category: doc.category }));

    if (process.env.OPENAI_API_KEY) {
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

    const reply = buildGenericFallback(sources);
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
