const mockPrisma = {
  pedido: {
    count: jest.fn(),
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
    it('deve retornar estatísticas do mês', async () => {
      mockPrisma.pedido.count.mockResolvedValue(10);
      mockPrisma.pedido.aggregate.mockResolvedValue({ _sum: { valorTotal: 5000 } });

      const result = await service.getStats();

      expect(result).toHaveProperty('totalPedidos');
      expect(result).toHaveProperty('faturamento');
      expect(result).toHaveProperty('despesas');
      expect(result).toHaveProperty('saldoMes');
      expect(result).toHaveProperty('trends');
    });

    it('deve calcular saldo como faturamento - despesas', async () => {
      mockPrisma.pedido.count.mockResolvedValue(5);
      mockPrisma.pedido.aggregate.mockResolvedValue({ _sum: { valorTotal: 20000 } });

      const result = await service.getStats();

      expect(result.saldoMes).toBe(result.faturamento - result.despesas);
    });
  });

  describe('getChart', () => {
    it('deve retornar dados dos últimos 5 meses', async () => {
      mockPrisma.pedido.aggregate.mockResolvedValue({ _sum: { valorTotal: 10000 } });

      const result = await service.getChart();

      expect(result).toHaveLength(5);
      expect(result[0]).toHaveProperty('mes');
      expect(result[0]).toHaveProperty('faturamento');
      expect(result[0]).toHaveProperty('despesas');
    });
  });
});
