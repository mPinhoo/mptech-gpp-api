import type { PeriodoInput } from '../utils/chat-period.js';
import { chatQueryService, type ChatUserContext } from './chat-query.service.js';

const PERIODO_PARAMS = {
  periodo: {
    type: 'string',
    enum: [
      'hoje',
      'semana',
      'mes',
      'mes_passado',
      'ano',
      'ultimos_n_dias',
      'ultimos_30_dias',
      'ate_hoje',
      'personalizado',
    ],
    description:
      'Período: hoje, semana (7 dias), mes (mês atual), mes_passado, ano (365 dias), ultimos_n_dias (usar com dias), ate_hoje (todo histórico), personalizado (usar data_de/data_ate).',
  },
  dias: {
    type: 'number',
    description: 'Número de dias para ultimos_n_dias (ex: 8, 10, 15, 60).',
  },
  data_de: { type: 'string', description: 'Data inicial YYYY-MM-DD (personalizado).' },
  data_ate: { type: 'string', description: 'Data final YYYY-MM-DD (personalizado).' },
};

function buildPeriodoArgs(args: Record<string, unknown>): PeriodoInput {
  return {
    periodo: args.periodo as PeriodoInput['periodo'],
    dias: args.dias as number | undefined,
    data_de: args.data_de as string | undefined,
    data_ate: args.data_ate as string | undefined,
  };
}

export const CHAT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'consultar_pedidos',
      description:
        'Consulta pedidos: quantidade, valor, lista e resumo por status (pendente, aprovado, concluído, cancelado). Use para qualquer pergunta sobre pedidos, inclusive "quantos pedidos fiz até hoje", pedidos aprovados, etc.',
      parameters: {
        type: 'object',
        properties: {
          ...PERIODO_PARAMS,
          status: {
            type: 'string',
            enum: ['PENDENTE', 'APROVADO', 'CONCLUIDO', 'CANCELADO'],
            description: 'Filtrar por status específico. Omitir para todos os status.',
          },
          incluir_resumo_status: {
            type: 'boolean',
            description: 'Incluir contagem por status (padrão true).',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'consultar_clientes',
      description:
        'Consulta clientes: total na base, mais recorrentes ou inativos (sem pedir há X dias).',
      parameters: {
        type: 'object',
        properties: {
          tipo: {
            type: 'string',
            enum: ['total', 'recorrentes', 'inativos'],
            description: 'total = quantos clientes na base; recorrentes = que mais pedem; inativos = sem pedir há tempo.',
          },
          limite: { type: 'number', description: 'Máximo de clientes na lista (padrão 10).' },
          periodo_meses: {
            type: 'number',
            description: 'Meses para calcular recorrentes (padrão 12).',
          },
          dias_sem_pedir: {
            type: 'number',
            description: 'Dias sem pedir para inativos (padrão 30).',
          },
        },
        required: ['tipo'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'consultar_estoque',
      description:
        'Consulta matérias-primas/insumos do estoque. Filtros: baixo, crítico, baixo_ou_critico, normal ou todos. Quando o usuário falar "produtos com estoque baixo", use esta ferramenta e explique que estoque = insumos.',
      parameters: {
        type: 'object',
        properties: {
          filtro: {
            type: 'string',
            enum: ['baixo_ou_critico', 'baixo', 'critico', 'normal', 'todos'],
            description: 'Filtro de status do estoque.',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'consultar_produtos',
      description:
        'Consulta produtos cadastrados ou ranking de mais/menos vendidos (saída) em um período.',
      parameters: {
        type: 'object',
        properties: {
          tipo: {
            type: 'string',
            enum: ['total', 'mais_vendidos', 'menos_vendidos'],
            description: 'total = cadastrados; mais_vendidos/menos_vendidos = ranking de vendas.',
          },
          ...PERIODO_PARAMS,
          limite: { type: 'number', description: 'Quantos produtos listar (padrão 10).' },
        },
        required: ['tipo'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'consultar_materiais_movimentacao',
      description:
        'Movimentação de insumos: entradas no estoque ou consumo estimado (saída) em pedidos aprovados/concluídos.',
      parameters: {
        type: 'object',
        properties: {
          tipo: {
            type: 'string',
            enum: ['entradas', 'consumo'],
            description: 'entradas = reposições; consumo = saída estimada via pedidos.',
          },
          ...PERIODO_PARAMS,
          limite: { type: 'number' },
          ordenar: { type: 'string', enum: ['mais', 'menos'] },
        },
        required: ['tipo'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'consultar_faturamento',
      description:
        'Consulta FATURAMENTO (receita de vendas). Use para: "quanto faturei", "faturamento da semana/mês/ano", "faturamento dos últimos N dias", período específico. Faturamento = pedidos Aprovados + Concluídos.',
      parameters: {
        type: 'object',
        properties: {
          ...PERIODO_PARAMS,
          incluir_despesas: {
            type: 'boolean',
            description: 'Se true, inclui também despesas e saldo. Padrão false (só faturamento).',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'consultar_resumo_financeiro',
      description:
        'Resumo financeiro completo: faturamento + despesas + saldo. Preferir consultar_faturamento quando o usuário perguntar só sobre faturamento/receita/vendas.',
      parameters: {
        type: 'object',
        properties: { ...PERIODO_PARAMS },
        required: [],
      },
    },
  },
];

export async function executeChatTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ChatUserContext
): Promise<unknown> {
  switch (name) {
    case 'consultar_pedidos':
      return chatQueryService.getPedidos(
        ctx,
        buildPeriodoArgs(args),
        args.status as string | undefined,
        args.incluir_resumo_status !== false
      );

    case 'consultar_clientes':
      return chatQueryService.getClientes(
        ctx,
        (args.tipo as 'total' | 'recorrentes' | 'inativos') || 'total',
        {
          limite: args.limite as number | undefined,
          periodoMeses: args.periodo_meses as number | undefined,
          diasSemPedir: args.dias_sem_pedir as number | undefined,
        }
      );

    case 'consultar_estoque':
      return chatQueryService.getEstoque(
        ctx,
        (args.filtro as 'baixo_ou_critico' | 'baixo' | 'critico' | 'normal' | 'todos') ||
          'baixo_ou_critico'
      );

    case 'consultar_produtos':
      return chatQueryService.getProdutos(
        ctx,
        (args.tipo as 'total' | 'mais_vendidos' | 'menos_vendidos') || 'total',
        buildPeriodoArgs(args),
        (args.limite as number) || 10
      );

    case 'consultar_materiais_movimentacao':
      return chatQueryService.getMateriaisMovimentacao(
        ctx,
        (args.tipo as 'entradas' | 'consumo') || 'entradas',
        buildPeriodoArgs(args),
        (args.limite as number) || 10,
        (args.ordenar as 'mais' | 'menos') || 'mais'
      );

    case 'consultar_faturamento':
      return chatQueryService.getFaturamento(
        ctx,
        buildPeriodoArgs(args),
        args.incluir_despesas === true
      );

    case 'consultar_resumo_financeiro':
      return chatQueryService.getResumoFinanceiro(ctx, buildPeriodoArgs(args));

    // Compatibilidade com nomes antigos
    case 'consultar_estoque_baixo':
      return chatQueryService.getEstoque(ctx, 'baixo_ou_critico');

    case 'consultar_clientes_recorrentes':
      return chatQueryService.getClientes(ctx, 'recorrentes', {
        limite: (args.limite as number) || 10,
        periodoMeses: (args.periodo_meses as number) || 12,
      });

    case 'consultar_clientes_inativos':
      return chatQueryService.getClientes(ctx, 'inativos', {
        diasSemPedir: (args.dias_sem_pedir as number) || 30,
        limite: (args.limite as number) || 20,
      });

    default:
      return { error: `Ferramenta desconhecida: ${name}` };
  }
}
