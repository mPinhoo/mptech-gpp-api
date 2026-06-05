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

## Prioridade: CONSULTAS AO SISTEMA
Quando a pergunta envolver números, listas, totais, rankings, períodos ou dados do negócio → **SEMPRE chame uma ferramenta antes de responder**. Nunca invente dados.

## Períodos — como interpretar
| Usuário diz | Parâmetros |
|-------------|------------|
| hoje / do dia | periodo: hoje |
| última semana / 7 dias | periodo: semana |
| este mês / mês atual | periodo: mes |
| mês passado | periodo: mes_passado |
| último ano / 365 dias | periodo: ano |
| últimos 10 dias / 8 dias / N dias | periodo: ultimos_n_dias, dias: N |
| até hoje / todo histórico / desde sempre | periodo: ate_hoje |
| de X a Y | periodo: personalizado, data_de, data_ate |

## Ferramentas — quando usar
- **consultar_pedidos** — pedidos, quantidades, status (aprovado, pendente...), valores. "Quantos pedidos fiz até hoje" → periodo: ate_hoje
- **consultar_clientes** — total na base (tipo: total), recorrentes, inativos
- **consultar_estoque** — insumos/materiais com estoque baixo, crítico ou normal. Se usuário disser "produtos com estoque baixo", use esta ferramenta e explique que estoque = insumos
- **consultar_produtos** — produtos cadastrados ou mais/menos vendidos (saída de produtos)
- **consultar_materiais_movimentacao** — entradas ou consumo/saída de insumos
- **consultar_faturamento** — faturamento/receita/vendas por período (semana, mês, ano, últimos N dias, intervalo). SEMPRE use para "quanto faturei", "faturamento da semana"
- **consultar_resumo_financeiro** — faturamento + despesas + saldo (quando pedir resumo completo)

## Perguntas de AJUDA ("como fazer")
Não use ferramentas. Use a documentação abaixo e responda com passos e menus.

## Formato das respostas
- Números e listas claras com **negrito**
- Tom direto em português do Brasil
- Se precisar de mais de uma ferramenta, chame todas necessárias
- Indique menus para ver mais: **Pedidos**, **Estoque**, **Clientes**, **Produtos**

## Regras
- NUNCA invente dados
- NUNCA use rotas, APIs ou código
- Kanban → Área de Trabalho; PENDENTE → aguardando aprovação`;

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

function isLikelyDataQuestion(message: string): boolean {
  return /quantos|quais|quanto|total|lista|ranking|mais|menos|estoque|pedidos?|clientes?|produtos?|faturamento|faturei|faturou|vendi|receita|vendas?|despesas|saldo|aprovad|pendente|cancelad|conclu|recorrente|inativ|semana|m[eê]s|ano|dias?|per[ií]odo|at[eé]\s+hoje|hist[oó]rico|sa[ií]da|entrada|consumo|vendidos?/i.test(
    message
  );
}

function isLikelyHelpQuestion(message: string): boolean {
  return /como\s+(fa[cç]o|crio|cadastro|envio|uso|funciona)|passo\s+a\s+passo|onde\s+(fica|encontro|clico)/i.test(
    message
  );
}

async function callOpenAIWithTools(
  messages: OpenAIMessage[],
  userCtx: ChatUserContext,
  forceTool: boolean
): Promise<{ reply: string; usedTools: boolean }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AppError('OPENAI_API_KEY não configurada', 503, 'AI_UNAVAILABLE');
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  let currentMessages = [...messages];
  let usedTools = false;

  for (let round = 0; round < 5; round++) {
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
        tool_choice: forceTool && round === 0 ? 'required' : 'auto',
        temperature: 0.2,
        max_tokens: 1000,
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
    forceTool = false;
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

function buildGenericFallback(sources: { title: string }[]): string {
  if (sources.length === 0) {
    return 'Posso consultar seus dados ou ajudar a usar o sistema. Exemplos:\n\n• "Quantos pedidos aprovados tive nos últimos 10 dias?"\n• "Quantos clientes temos na base?"\n• "Quais insumos estão com estoque crítico?"\n• "Produtos mais vendidos no último mês"\n• "Como crio um pedido?"';
  }

  const topic = sources[0].title;
  return `Sobre **${topic}**, posso te guiar passo a passo. Me diga o que você quer fazer.`;
}

export class ChatService {
  async ask(
    message: string,
    history: ChatMessage[] = [],
    userCtx?: ChatUserContext
  ): Promise<ChatResponse> {
    const hasAI = Boolean(process.env.OPENAI_API_KEY);
    const guide = matchUserGuide(message);
    const guideReply = guide ? formatUserGuideReply(guide) : null;
    const guideSources = guide
      ? [{ title: guide.title, category: 'guide' }]
      : [];

    const isHelp = isLikelyHelpQuestion(message);
    const isData = isLikelyDataQuestion(message);

    // Sem IA: guias e fallback por palavras-chave
    if (!hasAI) {
      if (guideReply) {
        return { reply: guideReply, sources: guideSources, mode: 'guide' };
      }
      if (userCtx && !isHelp) {
        const directReply = await tryDirectDataQuery(message, userCtx);
        if (directReply) {
          return {
            reply: directReply,
            sources: [{ title: 'Consulta ao sistema', category: 'query' }],
            mode: 'query',
          };
        }
      }
    }

    const documents = loadWikiDocuments();
    const relevant = searchWiki(documents, message);
    const context = formatDocumentsForPrompt(relevant);
    const sources = guideSources.length
      ? guideSources
      : relevant.map((doc) => ({ title: doc.title, category: doc.category }));

    // Com IA: priorizar ferramentas para consultas de dados
    if (hasAI && userCtx) {
      try {
        const guideSection = guideReply && isHelp
          ? `\n\n## Guia sugerido\n${guideReply}`
          : '';

        const docSection = isHelp || !isData
          ? `\n\n## Documentação de referência\n${context}`
          : '';

        const messages: OpenAIMessage[] = [
          {
            role: 'system',
            content: `${SYSTEM_PROMPT}${guideSection}${docSection}`,
          },
          ...history.slice(-8).map((msg) => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
          })),
          { role: 'user', content: message },
        ];

        const forceTool = isData && !isHelp;
        const { reply, usedTools } = await callOpenAIWithTools(messages, userCtx, forceTool);

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

    if (guideReply) {
      return { reply: guideReply, sources: guideSources, mode: 'guide' };
    }

    if (userCtx && isData && !isHelp) {
      const directReply = await tryDirectDataQuery(message, userCtx);
      if (directReply) {
        return {
          reply: directReply,
          sources: [{ title: 'Consulta ao sistema', category: 'query' }],
          mode: 'query',
        };
      }
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
