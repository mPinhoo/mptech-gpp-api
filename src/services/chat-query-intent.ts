import { executeChatTool } from './chat-tools.js';
import type { ChatUserContext } from './chat-query.service.js';

interface DataQueryMatch {
  tool: string;
  args: Record<string, unknown>;
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

function extractDias(text: string): number | undefined {
  const match = text.match(/(\d+)\s*dias?/i);
  return match ? parseInt(match[1], 10) : undefined;
}

function extractPeriodo(text: string): Record<string, unknown> {
  const dias = extractDias(text);
  if (dias) return { periodo: 'ultimos_n_dias', dias };
  if (/at[eé]\s+hoje|todo\s+hist|desde\s+sempre/i.test(text)) return { periodo: 'ate_hoje' };
  if (/m[eê]s\s+passado/i.test(text)) return { periodo: 'mes_passado' };
  if (/[uú]ltimo\s+ano|365/i.test(text)) return { periodo: 'ano' };
  if (/semana|7\s*dias/i.test(text)) return { periodo: 'semana' };
  if (/hoje|do\s+dia/i.test(text)) return { periodo: 'hoje' };
  if (/m[eê]s/i.test(text)) return { periodo: 'mes' };
  return { periodo: 'mes' };
}

function extractStatus(text: string): string | undefined {
  if (/aprovad/i.test(text)) return 'APROVADO';
  if (/pendente/i.test(text)) return 'PENDENTE';
  if (/cancelad/i.test(text)) return 'CANCELADO';
  if (/conclu/i.test(text)) return 'CONCLUIDO';
  return undefined;
}

function isHelpQuestion(text: string): boolean {
  return /como\s+(fa[cç]o|crio|cadastro|envio|uso|funciona)|passo\s+a\s+passo|onde\s+(fica|encontro|clico)/i.test(
    text
  );
}

export function matchDataQuery(message: string): DataQueryMatch | null {
  const text = message.toLowerCase();

  if (isHelpQuestion(text)) return null;

  if (/quantos\s+clientes|total\s+de\s+clientes|clientes\s+na\s+base|clientes\s+cadastrados/i.test(text)) {
    return { tool: 'consultar_clientes', args: { tipo: 'total' } };
  }

  if (/estoque|insumos?|materiais?/i.test(text) && /baixo|cr[ií]tico|acabando|falta/i.test(text)) {
    const filtro = /cr[ií]tico/i.test(text) ? 'critico' : 'baixo_ou_critico';
    return { tool: 'consultar_estoque', args: { filtro } };
  }

  if (/produtos?.*(mais|menos)\s+vendid|mais\s+vendid|menos\s+vendid/i.test(text)) {
    const tipo = /menos/i.test(text) ? 'menos_vendidos' : 'mais_vendidos';
    return { tool: 'consultar_produtos', args: { tipo, ...extractPeriodo(text) } };
  }

  if (/entradas?\s+(de\s+)?estoque|mais\s+entrada/i.test(text)) {
    return {
      tool: 'consultar_materiais_movimentacao',
      args: { tipo: 'entradas', ordenar: /menos/i.test(text) ? 'menos' : 'mais', ...extractPeriodo(text) },
    };
  }

  if (/sa[ií]da|consumo/i.test(text) && /estoque|insumos?|materiais?/i.test(text)) {
    return {
      tool: 'consultar_materiais_movimentacao',
      args: { tipo: 'consumo', ordenar: /menos/i.test(text) ? 'menos' : 'mais', ...extractPeriodo(text) },
    };
  }

  if (
    /pedidos?/i.test(text) &&
    /quantos|quais|total|aprovad|pendente|cancelad|conclu|valor|fiz|tive|lista|[uú]ltimos?|semana|m[eê]s|hoje|ano|dias?/i.test(
      text
    )
  ) {
    const status = extractStatus(text);
    return {
      tool: 'consultar_pedidos',
      args: { ...extractPeriodo(text), status, incluir_resumo_status: !status },
    };
  }

  if (/clientes?.*recorrentes?|clientes?.*frequentes?|clientes?.*mais\s+pedem|top\s+clientes?/i.test(text)) {
    return { tool: 'consultar_clientes', args: { tipo: 'recorrentes', limite: 10 } };
  }

  if (/clientes?.*inativos?|n[aã]o\s+pedem|sem\s+pedir/i.test(text)) {
    return {
      tool: 'consultar_clientes',
      args: { tipo: 'inativos', dias_sem_pedir: extractDias(text) ?? 30 },
    };
  }

  if (/faturamento|quanto\s+faturei|resumo\s+financeiro|despesas?/i.test(text)) {
    return { tool: 'consultar_resumo_financeiro', args: extractPeriodo(text) };
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
  if (data.error) return String(data.error);

  switch (tool) {
    case 'consultar_estoque':
    case 'consultar_estoque_baixo': {
      const itens = (data.itens as Array<{ nome: string; quantidade: number; minimo: number; unidade: string; status: string }>) || [];
      if (itens.length === 0) {
        return 'Nenhum material encontrado com esse filtro de estoque.';
      }
      const linhas = itens.map(
        (i) => `• **${i.nome}** — ${i.quantidade} ${i.unidade} (mín: ${i.minimo}) — *${i.status}*`
      );
      return `**${data.total}** materiais (${data.criticos ?? 0} críticos, ${data.baixos ?? 0} baixos):\n\n${linhas.join('\n')}`;
    }

    case 'consultar_pedidos': {
      const pedidos = (data.pedidos as Array<{ numero: string; cliente: string; data: string; valor: string; status: string }>) || [];
      const porStatus = (data.porStatus as Array<{ status: string; quantidade: number }>) || [];
      let reply = `**${data.total}** pedido(s) ${data.periodo}`;
      if (data.statusFiltro) reply += ` (${data.statusFiltro})`;
      if (data.valorTotal) reply += ` — **${formatCurrency(data.valorTotal as number)}**`;
      if (porStatus.length > 0) {
        reply += `\n\nPor status:\n${porStatus.map((s) => `• ${s.status}: **${s.quantidade}**`).join('\n')}`;
      }
      if (pedidos.length > 0) {
        reply += `\n\nÚltimos:\n${pedidos.slice(0, 8).map((p) => `• **${p.numero}** — ${p.cliente} — ${p.status}`).join('\n')}`;
      }
      return reply;
    }

    case 'consultar_clientes': {
      if (data.tipo === 'total') {
        return `**${data.ativos}** clientes ativos na base (${data.comPedido} já pediram, ${data.semPedido} nunca pediram). Total geral: **${data.totalGeral}**.`;
      }
      if (data.tipo === 'recorrentes') {
        const clientes = (data.clientes as Array<{ nome: string; totalPedidos: number; valorTotal: number }>) || [];
        if (!clientes.length) return 'Sem dados de clientes recorrentes.';
        return clientes.map((c, i) => `${i + 1}. **${c.nome}** — ${c.totalPedidos} pedidos — ${formatCurrency(c.valorTotal)}`).join('\n');
      }
      const semPedido = (data.clientesSemPedidoRecente as Array<{ nome: string; diasSemPedir: number }>) || [];
      const nunca = (data.clientesNuncaPediram as Array<{ nome: string }>) || [];
      const parts: string[] = [];
      if (semPedido.length) parts.push(semPedido.map((c) => `• **${c.nome}** (${c.diasSemPedir} dias)`).join('\n'));
      if (nunca.length) parts.push(`Nunca pediram:\n${nunca.map((c) => `• **${c.nome}**`).join('\n')}`);
      return parts.join('\n\n') || 'Nenhum cliente inativo encontrado.';
    }

    case 'consultar_produtos': {
      if (data.tipo === 'total') {
        return `**${data.total}** produtos cadastrados (${data.ativos} ativos, ${data.inativos} inativos).`;
      }
      const produtos = (data.produtos as Array<{ nome: string; quantidadeVendida: number }>) || [];
      if (!produtos.length) return `Nenhuma venda ${data.periodo}.`;
      return produtos.map((p, i) => `${i + 1}. **${p.nome}** — ${p.quantidadeVendida} un.`).join('\n');
    }

    case 'consultar_materiais_movimentacao': {
      const materiais = (data.materiais as Array<{ nome: string; quantidade: number; unidade: string }>) || [];
      if (!materiais.length) return `Sem movimentação ${data.periodo}.`;
      return materiais.map((m, i) => `${i + 1}. **${m.nome}** — ${m.quantidade} ${m.unidade}`).join('\n');
    }

    case 'consultar_resumo_financeiro':
      return `Resumo ${data.periodo}:\n• Pedidos: **${data.totalPedidos}**\n• Faturamento: **${formatCurrency(data.faturamento as number)}**\n• Despesas: **${formatCurrency(data.despesas as number)}**\n• Saldo: **${formatCurrency(data.saldo as number)}**`;

    case 'consultar_clientes_recorrentes':
      return formatToolResult('consultar_clientes', { ...data, tipo: 'recorrentes' });

    case 'consultar_clientes_inativos':
      return formatToolResult('consultar_clientes', { ...data, tipo: 'inativos' });

    default:
      return JSON.stringify(data, null, 2);
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
