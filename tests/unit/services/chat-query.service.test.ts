const USER_ID = 'user-1';
const USER_EMAIL = 'user@test.com';

const mockPrisma = {
  materiaPrima: { findMany: jest.fn() },
  pedido: {
    count: jest.fn(),
    findMany: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
  },
  cliente: { findMany: jest.fn() },
  despesa: { aggregate: jest.fn() },
  $queryRaw: jest.fn(),
};

jest.mock('@/utils/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

jest.mock('@/services/permissions.service', () => ({
  userCan: jest.fn().mockResolvedValue(true),
}));

import { ChatQueryService } from '@/services/chat-query.service';

const ctx = { userId: USER_ID, email: USER_EMAIL };

describe('ChatQueryService', () => {
  let service: ChatQueryService;

  beforeEach(() => {
    service = new ChatQueryService();
    jest.clearAllMocks();
  });

  describe('getEstoqueBaixo', () => {
    it('retorna apenas itens baixo e crítico', async () => {
      mockPrisma.materiaPrima.findMany.mockResolvedValue([
        { nome: 'A', quantidade: 200, quantidadeMinima: 100, unidade: 'un' },
        { nome: 'B', quantidade: 120, quantidadeMinima: 100, unidade: 'un' },
        { nome: 'C', quantidade: 50, quantidadeMinima: 100, unidade: 'un' },
      ]);

      const result = await service.getEstoqueBaixo(ctx);

      expect(result.total).toBe(2);
      expect(result.criticos).toBe(1);
      expect(result.itens?.[0].nome).toBe('B');
      expect(result.itens?.[1].status).toBe('Crítico');
    });
  });

  describe('getPedidosPeriodo', () => {
    it('retorna contagem e lista de pedidos', async () => {
      mockPrisma.pedido.count.mockResolvedValue(2);
      mockPrisma.pedido.findMany.mockResolvedValue([
        {
          numero: 'P001',
          dataPedido: new Date('2026-06-01T12:00:00Z'),
          valorTotal: 100,
          status: 'APROVADO',
          cliente: { nome: 'Cliente A' },
        },
      ]);
      mockPrisma.pedido.aggregate.mockResolvedValue({ _sum: { valorTotal: 200 } });

      const result = await service.getPedidosPeriodo(ctx, 'mes');

      expect(result.total).toBe(2);
      expect(result.valorTotal).toBe(200);
      expect(result.pedidos).toHaveLength(1);
      expect(result.pedidos?.[0].cliente).toBe('Cliente A');
    });
  });
});
