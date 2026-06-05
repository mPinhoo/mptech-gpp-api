import { executeChatTool } from './chat-tools.js';
import type { ChatUserContext } from './chat-query.service.js';

interface DataQueryMatch {
  tool: string;
  args: Record<string, unknown>;
}

const ESTOQUE_PATTERNS = [
  /estoque\s+baixo/i,
  /estoque\s+cr[ií]tico/i,
  /materiais?\s+baixo/i,
  /insumos?\s+baixo/i,
  /acabando\s+o\s+estoque/i,
  /falta\s+de\s+estoque/i,
  /quais\s+.*estoque/i,
];

const PEDIDOS_HOJE = [
  /pedidos?.*hoje/i,
  /hoje.*pedidos?/i,
  /pedidos?\s+do\s+dia/i,
  /quantos\s+pedidos?.*hoje/i,
];
const PEDIDOS_SEMANA = [
  /pedidos?.*(semana|7\s*dias)/i,
  /quantos\s+pedidos?.*semana/i,
  /[uú]ltima\s+semana/i,
];
const PEDIDOS_MES = [
  /pedidos?.*(m[eê]s)/i,
  /quantos\s+pedidos?.*m[eê]s/i,
  /[uú]ltimo\s+m[eê]s/i,
  /neste\s+m[eê]s/i,
];

const CLIENTES_RECORRENTES = [
  /clientes?.*recorrentes?/i,
  /clientes?.*frequentes?/i,
  /clientes?.*mais\s+pedem/i,
  /mais\s+pedidos?.*cliente/i,
  /top\s+clientes?/i,
];

const CLIENTES_INATIVOS = [
  /clientes?\s+inativos?/i,
  /clientes?\s+que\s+n[aã]o\s+pedem/i,
  /sem\s+pedir\s+h[aá]/i,
  /n[aã]o\s+pedem\s+h[aá]/i,
  /clientes?\s+parados?/i,
];

const RESUMO_FINANCEIRO = [
  /faturamento/i,
  /quanto\s+faturei/i,
  /resumo\s+financeiro/i,
  /quanto\s+vendi/i,
  /despesas?\s+do\s+m[eê]s/i,
];

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

function extractDias(text: string): number {
  const match = text.match(/(\d+)\s*dias?/i);
  return match ? parseInt(match[1], 10) : 30;
}

export function matchDataQuery(message: string): DataQueryMatch | null {
  const text = message.toLowerCase();

  if (matchesAny(text, ESTOQUE_PATTERNS)) {
    return { tool: 'consultar_estoque_baixo', args: {} };
  }

  if (matchesAny(text, PEDIDOS_HOJE)) {
    return { tool: 'consultar_pedidos', args: { periodo: 'hoje' } };
  }

  if (matchesAny(text, PEDIDOS_SEMANA)) {
    return { tool: 'consultar_pedidos', args: { periodo: 'semana' } };
  }

  if (matchesAny(text, PEDIDOS_MES)) {
    return { tool: 'consultar_pedidos', args: { periodo: 'mes' } };
  }

  if (matchesAny(text, CLIENTES_RECORRENTES)) {
    return { tool: 'consultar_clientes_recorrentes', args: { limite: 10 } };
  }

  if (matchesAny(text, CLIENTES_INATIVOS)) {
    return { tool: 'consultar_clientes_inativos', args: { dias_sem_pedir: extractDias(text) } };
  }

  if (matchesAny(text, RESUMO_FINANCEIRO)) {
    return { tool: 'consultar_resumo_financeiro', args: { periodo: 'mes' } };
  }

  return null;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatToolResult(tool: string, result: unknown): string {
  if (!result || typeof result !== 'object') {
    return 'Não consegui obter os dados. Tente novamente.';
  }

  const data = result as Record<string, unknown>;

  if (data.error) {
    return String(data.error);
  }

  switch (tool) {
    case 'consultar_estoque_baixo': {
      const itens = (data.itens as Array<{ nome: string; quantidade: number; minimo: number; unidade: string; status: string }>) || [];
      if (itens.length === 0) {
        return 'Boa notícia! Nenhum material está com estoque baixo ou crítico no momento.';
      }
      const linhas = itens.map(
        (i) =>
          `• **${i.nome}** — ${i.quantidade} ${i.unidade} (mín: ${i.minimo}) — *${i.status}*`
      );
      return `Encontrei **${data.total}** materiais com estoque baixo ou crítico:\n\n${linhas.join('\n')}\n\nAcesse **Estoque** no menu para repor.`;
    }

    case 'consultar_pedidos': {
      const pedidos = (data.pedidos as Array<{ numero: string; cliente: string; data: string; valor: string; status: string }>) || [];
      let reply = `**${data.total}** pedido(s) ${data.periodo}`;
      if (data.valorTotal) {
        reply += `, totalizando **${formatCurrency(data.valorTotal as number)}**`;
      }
      reply += '.';
      if (pedidos.length > 0) {
        const linhas = pedidos.slice(0, 10).map(
          (p) => `• **${p.numero}** — ${p.cliente} — ${p.data} — ${p.valor} (${p.status})`
        );
        reply += `\n\nÚltimos pedidos:\n${linhas.join('\n')}`;
        if ((data.total as number) > 10) {
          reply += `\n\n... e mais ${(data.total as number) - 10}. Veja todos em **Pedidos**.`;
        }
      }
      return reply;
    }

    case 'consultar_clientes_recorrentes': {
      const clientes = (data.clientes as Array<{ nome: string; totalPedidos: number; valorTotal: number }>) || [];
      if (clientes.length === 0) {
        return 'Ainda não há pedidos suficientes para identificar clientes recorrentes.';
      }
      const linhas = clientes.map(
        (c, i) =>
          `${i + 1}. **${c.nome}** — ${c.totalPedidos} pedido(s) — ${formatCurrency(c.valorTotal)}`
      );
      return `Clientes mais recorrentes (últimos ${data.periodoMeses} meses):\n\n${linhas.join('\n')}`;
    }

    case 'consultar_clientes_inativos': {
      const semPedido = (data.clientesSemPedidoRecente as Array<{ nome: string; ultimoPedido: string; diasSemPedir: number }>) || [];
      const nunca = (data.clientesNuncaPediram as Array<{ nome: string }>) || [];
      const parts: string[] = [];

      if (semPedido.length > 0) {
        const linhas = semPedido.map(
          (c) => `• **${c.nome}** — último pedido em ${c.ultimoPedido} (${c.diasSemPedir} dias)`
        );
        parts.push(`Clientes sem pedir há mais de ${data.diasSemPedir} dias:\n${linhas.join('\n')}`);
      }

      if (nunca.length > 0) {
        const linhas = nunca.map((c) => `• **${c.nome}**`);
        parts.push(`Clientes que nunca pediram:\n${linhas.join('\n')}`);
      }

      if (parts.length === 0) {
        return `Todos os clientes ativos pediram nos últimos ${data.diasSemPedir} dias.`;
      }

      return parts.join('\n\n');
    }

    case 'consultar_resumo_financeiro': {
      return `Resumo ${data.periodo}:\n\n• **Pedidos:** ${data.totalPedidos}\n• **Faturamento:** ${formatCurrency(data.faturamento as number)}\n• **Despesas:** ${formatCurrency(data.despesas as number)}\n• **Saldo:** ${formatCurrency(data.saldo as number)}`;
    }

    default:
      return 'Consulta realizada, mas não sei formatar o resultado.';
  }
}

export async function tryDirectDataQuery(
  message: string,
  ctx: ChatUserContext
): Promise<string | null> {
  const match = matchDataQuery(message);
  if (!match) return null;

  const result = await executeChatTool(match.tool, match.args, ctx);
  return formatToolResult(match.tool, result);
}
