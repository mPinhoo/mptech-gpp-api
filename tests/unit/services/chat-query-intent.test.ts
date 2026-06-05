jest.mock('@/utils/prisma', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('@/services/permissions.service', () => ({
  userCan: jest.fn().mockResolvedValue(true),
}));

import { matchDataQuery, formatToolResult } from '@/services/chat-query-intent';

describe('chat-query-intent', () => {
  describe('matchDataQuery', () => {
    it('detecta total de clientes', () => {
      expect(matchDataQuery('Quantos clientes temos na base?')).toEqual({
        tool: 'consultar_clientes',
        args: { tipo: 'total' },
      });
    });

    it('detecta pedidos com dias customizados', () => {
      expect(matchDataQuery('Pedidos dos últimos 10 dias')).toEqual({
        tool: 'consultar_pedidos',
        args: { periodo: 'ultimos_n_dias', dias: 10, incluir_resumo_status: true },
      });
    });

    it('detecta pedidos aprovados até hoje', () => {
      expect(matchDataQuery('Quantos pedidos aprovados até hoje?')).toEqual({
        tool: 'consultar_pedidos',
        args: { periodo: 'ate_hoje', status: 'APROVADO', incluir_resumo_status: false },
      });
    });

    it('detecta faturamento da última semana', () => {
      expect(matchDataQuery('Qual o faturamento da última semana?')).toEqual({
        tool: 'consultar_faturamento',
        args: { periodo: 'semana' },
      });
    });

    it('detecta faturamento dos últimos N dias', () => {
      expect(matchDataQuery('Quanto faturei nos últimos 15 dias?')).toEqual({
        tool: 'consultar_faturamento',
        args: { periodo: 'ultimos_n_dias', dias: 15 },
      });
    });

    it('detecta faturamento do último ano', () => {
      expect(matchDataQuery('Faturamento do último ano')).toEqual({
        tool: 'consultar_faturamento',
        args: { periodo: 'ano' },
      });
    });

    it('detecta resumo financeiro com despesas', () => {
      expect(matchDataQuery('Faturamento e despesas do mês')).toEqual({
        tool: 'consultar_resumo_financeiro',
        args: { periodo: 'mes' },
      });
    });

    it('detecta produtos mais vendidos', () => {
      expect(matchDataQuery('Produtos mais vendidos no último mês')).toEqual({
        tool: 'consultar_produtos',
        args: { tipo: 'mais_vendidos', periodo: 'mes_passado' },
      });
    });

    it('não detecta perguntas de ajuda', () => {
      expect(matchDataQuery('Como faço um novo pedido?')).toBeNull();
    });
  });

  describe('formatToolResult', () => {
    it('formata total de clientes', () => {
      const reply = formatToolResult('consultar_clientes', {
        tipo: 'total',
        ativos: 50,
        comPedido: 40,
        semPedido: 10,
        totalGeral: 55,
        inativos: 5,
      });
      expect(reply).toContain('50');
      expect(reply).toContain('clientes ativos');
    });

    it('formata pedidos com resumo por status', () => {
      const reply = formatToolResult('consultar_pedidos', {
        total: 10,
        periodo: 'neste mês',
        valorTotal: 5000,
        porStatus: [{ status: 'Aprovado', quantidade: 6 }],
        pedidos: [],
      });
      expect(reply).toContain('10');
      expect(reply).toContain('Aprovado');
    });
  });
});
