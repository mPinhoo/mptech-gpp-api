import { chatQueryService, type ChatUserContext } from './chat-query.service.js';

export const CHAT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'consultar_estoque_baixo',
      description:
        'Lista matérias-primas (insumos) com estoque baixo ou crítico. Use quando o usuário perguntar sobre estoque baixo, materiais acabando, insumos em falta.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'consultar_pedidos',
      description:
        'Consulta pedidos por período: hoje, semana, mês ou intervalo personalizado. Retorna quantidade, valor total e lista dos pedidos.',
      parameters: {
        type: 'object',
        properties: {
          periodo: {
            type: 'string',
            enum: ['hoje', 'semana', 'mes', 'ultimos_30_dias', 'personalizado'],
            description: 'Período da consulta. Padrão: mes.',
          },
          data_de: { type: 'string', description: 'Data inicial YYYY-MM-DD (só para personalizado)' },
          data_ate: { type: 'string', description: 'Data final YYYY-MM-DD (só para personalizado)' },
          status: {
            type: 'string',
            enum: ['PENDENTE', 'APROVADO', 'CONCLUIDO', 'CANCELADO'],
            description: 'Filtrar por status (opcional)',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'consultar_clientes_recorrentes',
      description:
        'Lista os clientes que mais fizeram pedidos (mais recorrentes/frequentes) em um período.',
      parameters: {
        type: 'object',
        properties: {
          limite: { type: 'number', description: 'Quantos clientes listar (padrão 10)' },
          periodo_meses: {
            type: 'number',
            description: 'Janela em meses para contar pedidos (padrão 12)',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'consultar_clientes_inativos',
      description:
        'Lista clientes que não pedem há um certo tempo ou nunca fizeram pedido.',
      parameters: {
        type: 'object',
        properties: {
          dias_sem_pedir: {
            type: 'number',
            description: 'Dias sem pedir para considerar inativo (padrão 30)',
          },
          limite: { type: 'number', description: 'Máximo de clientes (padrão 20)' },
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
        'Resumo financeiro: total de pedidos, faturamento, despesas e saldo em um período.',
      parameters: {
        type: 'object',
        properties: {
          periodo: {
            type: 'string',
            enum: ['hoje', 'semana', 'mes', 'ultimos_30_dias', 'personalizado'],
          },
          data_de: { type: 'string' },
          data_ate: { type: 'string' },
        },
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
    case 'consultar_estoque_baixo':
      return chatQueryService.getEstoqueBaixo(ctx);

    case 'consultar_pedidos':
      return chatQueryService.getPedidosPeriodo(
        ctx,
        (args.periodo as 'hoje' | 'semana' | 'mes' | 'ultimos_30_dias' | 'personalizado') ||
          'mes',
        args.data_de as string | undefined,
        args.data_ate as string | undefined,
        args.status as string | undefined
      );

    case 'consultar_clientes_recorrentes':
      return chatQueryService.getClientesRecorrentes(
        ctx,
        (args.limite as number) || 10,
        (args.periodo_meses as number) || 12
      );

    case 'consultar_clientes_inativos':
      return chatQueryService.getClientesInativos(
        ctx,
        (args.dias_sem_pedir as number) || 30,
        (args.limite as number) || 20
      );

    case 'consultar_resumo_financeiro':
      return chatQueryService.getResumoFinanceiro(
        ctx,
        (args.periodo as 'hoje' | 'semana' | 'mes' | 'ultimos_30_dias' | 'personalizado') ||
          'mes',
        args.data_de as string | undefined,
        args.data_ate as string | undefined
      );

    default:
      return { error: `Ferramenta desconhecida: ${name}` };
  }
}
