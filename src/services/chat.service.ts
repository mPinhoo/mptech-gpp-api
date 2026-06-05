import { AppError } from '../utils/errors.js';
import { loadWikiDocuments } from './wiki/wiki-loader.js';
import { formatDocumentsForPrompt, searchWiki } from './wiki/wiki-search.js';
import { buildUserFriendlyExcerpt } from './wiki/wiki-simplify.js';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  reply: string;
  sources: { title: string; category: string }[];
  mode: 'ai' | 'search';
}

const SYSTEM_PROMPT = `Você é a assistente virtual do Zentra — sistema de gestão para negócios de personalização (brindes, festas, produtos customizados).

## Público
Usuários finais do sistema: donos de negócio, vendedores, produção e administradores. Eles NÃO são desenvolvedores.

## Sua missão
Transformar a documentação técnica fornecida em respostas simples e práticas. A documentação é técnica de propósito — você deve TRADUZIR tudo para linguagem do dia a dia.

## Como responder
- Fale de forma calorosa e direta, como um colega experiente.
- Indique ONDE clicar: menus da barra lateral (Pedidos, Produtos, Estoque, Área de Trabalho, Agenda, Clientes, Precificação, Início).
- Use passos numerados em procedimentos ("1. Clique em Pedidos... 2. Depois em Novo Pedido...").
- Traduza termos: Kanban → Área de Trabalho; PENDENTE → aguardando aprovação; APROVADO → aprovado; BOM → lista de materiais.
- Seja breve: 3 a 6 frases ou um passo a passo curto.

## O que NUNCA incluir na resposta
- Endpoints, APIs, rotas técnicas (/api/...), código, banco de dados, JWT, tokens, nomes de arquivos, variáveis de ambiente, arquitetura de software.
- Não copie trechos técnicos da documentação — sempre reescreva para o usuário.

## Permissões
Se algo exigir acesso especial: "Para isso você precisa de permissão em [menu]. Peça ao administrador da sua conta."

## Quando não souber
Diga: "Não encontrei isso no manual. Tente perguntar o que você quer fazer — por exemplo: criar um pedido, cadastrar produto ou ver o estoque."`;

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
      content: `${SYSTEM_PROMPT}\n\n## Documentação de referência (técnica — traduza para o usuário)\n\n${context}`,
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
      temperature: 0.5,
      max_tokens: 650,
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

function buildSearchFallback(
  sources: { title: string }[],
  documents: { content: string }[]
): string {
  if (sources.length === 0 || documents.length === 0) {
    return 'Não encontrei isso no manual do sistema. Tente perguntar de outro jeito — por exemplo: "Como faço um novo pedido?" ou "Onde vejo a produção?"';
  }

  const main = buildUserFriendlyExcerpt(documents[0].content);

  if (sources.length === 1) {
    return `${main}\n\nSe precisar de mais detalhes, me diga o que você quer fazer que eu te ajudo!`;
  }

  const others = sources
    .slice(1, 3)
    .map((s) => s.title.toLowerCase())
    .join(' ou ');

  return `${main}\n\nPosso ajudar também com ${others}. É só perguntar!`;
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
          // fall through
        } else if (err instanceof AppError) {
          throw err;
        }
      }
    }

    const reply = buildSearchFallback(
      sources,
      relevant.map((doc) => ({ content: doc.content }))
    );
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
