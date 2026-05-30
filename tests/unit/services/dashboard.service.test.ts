const USER_ID = 'user-1';

const mockPrisma = {
  pedido: {
    count: jest.fn(),
    aggregate: jest.fn(),
  },
  despesa: {
    aggregate: jest.fn(),
  },
};

jest.mock('@/utils/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

import { DashboardService } from '@/services/dashboard.service';

describe('DashboardService', () => {
  let service: DashboardService;

  beforeEach(() => {
    service = new DashboardService();
    jest.clearAllMocks();
  });

  describe('getStats', () => {
    it('deve retornar estatísticas do período padrão (este mês)', async () => {
      mockPrisma.pedido.count.mockResolvedValue(10);
      mockPrisma.pedido.aggregate.mockResolvedValue({ _sum: { valorTotal: 5000 } });
      mockPrisma.despesa.aggregate.mockResolvedValue({ _sum: { valor: 1000 } });

      const result = await service.getStats(USER_ID);

      expect(result).toHaveProperty('totalPedidos');
      expect(result).toHaveProperty('faturamento');
      expect(result).toHaveProperty('despesas');
      expect(result).toHaveProperty('saldoMes');
      expect(result).toHaveProperty('trends');
      expect(result.periodo).toHaveProperty('dataDe');
      expect(result.periodo).toHaveProperty('dataAte');
    });

    it('deve calcular saldo como faturamento - despesas', async () => {
      mockPrisma.pedido.count.mockResolvedValue(5);
      mockPrisma.pedido.aggregate.mockResolvedValue({ _sum: { valorTotal: 20000 } });
      mockPrisma.despesa.aggregate.mockResolvedValue({ _sum: { valor: 5000 } });

      const result = await service.getStats(USER_ID, '2026-04-01', '2026-04-30');

      expect(result.saldoMes).toBe(result.faturamento - result.despesas);
    });

    it('deve somar faturamento de pedidos aprovados e concluídos', async () => {
      mockPrisma.pedido.count.mockResolvedValue(3);
      mockPrisma.pedido.aggregate.mockResolvedValue({ _sum: { valorTotal: 1500 } });
      mockPrisma.despesa.aggregate.mockResolvedValue({ _sum: { valor: 0 } });

      await service.getStats(USER_ID, '2026-04-01', '2026-04-30');

      expect(mockPrisma.pedido.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['APROVADO', 'CONCLUIDO'] },
            dataPedido: expect.any(Object),
          }),
        })
      );
    });
  });

  describe('getChart', () => {
    it('deve retornar dados semanais para período curto', async () => {
      mockPrisma.pedido.aggregate.mockResolvedValue({ _sum: { valorTotal: 10000 } });
      mockPrisma.despesa.aggregate.mockResolvedValue({ _sum: { valor: 2000 } });

      const result = await service.getChart(USER_ID, '2026-04-01', '2026-04-30');

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('mes');
      expect(result[0]).toHaveProperty('faturamento');
      expect(result[0]).toHaveProperty('despesas');
    });

    it('deve retornar dados mensais para período longo', async () => {
      mockPrisma.pedido.aggregate.mockResolvedValue({ _sum: { valorTotal: 10000 } });
      mockPrisma.despesa.aggregate.mockResolvedValue({ _sum: { valor: 2000 } });

      const result = await service.getChart(USER_ID, '2026-01-01', '2026-06-30');

      expect(result.length).toBeGreaterThan(1);
      expect(result[0]).toHaveProperty('mes');
    });
  });
});
