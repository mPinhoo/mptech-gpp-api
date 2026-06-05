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
    it('detecta consulta de estoque baixo', () => {
      expect(matchDataQuery('Quais materiais estão com estoque baixo?')).toEqual({
        tool: 'consultar_estoque_baixo',
        args: {},
      });
    });

    it('detecta pedidos do dia', () => {
      expect(matchDataQuery('Quantos pedidos tive hoje?')).toEqual({
        tool: 'consultar_pedidos',
        args: { periodo: 'hoje' },
      });
    });

    it('detecta pedidos da semana', () => {
      expect(matchDataQuery('Pedidos da última semana')).toEqual({
        tool: 'consultar_pedidos',
        args: { periodo: 'semana' },
      });
    });

    it('detecta clientes recorrentes', () => {
      expect(matchDataQuery('Quais clientes são mais recorrentes?')).toEqual({
        tool: 'consultar_clientes_recorrentes',
        args: { limite: 10 },
      });
    });

    it('detecta clientes inativos com dias customizados', () => {
      expect(matchDataQuery('Clientes que não pedem há 60 dias')).toEqual({
        tool: 'consultar_clientes_inativos',
        args: { dias_sem_pedir: 60 },
      });
    });

    it('não detecta perguntas de ajuda', () => {
      expect(matchDataQuery('Como faço um novo pedido?')).toBeNull();
    });
  });

  describe('formatToolResult', () => {
    it('formata estoque vazio', () => {
      const reply = formatToolResult('consultar_estoque_baixo', { total: 0, itens: [] });
      expect(reply).toContain('Nenhum material');
    });

    it('formata pedidos com total', () => {
      const reply = formatToolResult('consultar_pedidos', {
        total: 3,
        periodo: 'neste mês',
        valorTotal: 1500,
        pedidos: [
          { numero: 'P001', cliente: 'João', data: '01/06/2026', valor: 'R$ 500,00', status: 'Aprovado' },
        ],
      });
      expect(reply).toContain('3');
      expect(reply).toContain('P001');
    });

    it('formata erro de permissão', () => {
      const reply = formatToolResult('consultar_pedidos', {
        error: 'Sem permissão',
      });
      expect(reply).toBe('Sem permissão');
    });
  });
});
