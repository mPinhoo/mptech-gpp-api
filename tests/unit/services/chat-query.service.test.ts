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
  cliente: { count: jest.fn(), findMany: jest.fn() },
  produto: { count: jest.fn(), findMany: jest.fn() },
  itemPedido: { groupBy: jest.fn() },
  despesa: { findMany: jest.fn(), aggregate: jest.fn() },
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

  describe('getEstoque', () => {
    it('retorna apenas itens baixo e crítico', async () => {
      mockPrisma.materiaPrima.findMany.mockResolvedValue([
        { nome: 'A', quantidade: 200, quantidadeMinima: 100, unidade: 'un' },
        { nome: 'B', quantidade: 120, quantidadeMinima: 100, unidade: 'un' },
        { nome: 'C', quantidade: 50, quantidadeMinima: 100, unidade: 'un' },
      ]);

      const result = await service.getEstoque(ctx);

      expect(result.total).toBe(2);
      expect(result.criticos).toBe(1);
    });
  });

  describe('getClientes total', () => {
    it('retorna contagem de clientes', async () => {
      mockPrisma.cliente.count
        .mockResolvedValueOnce(40)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(35)
        .mockResolvedValueOnce(5);

      const result = await service.getClientes(ctx, 'total');

      expect(result.ativos).toBe(40);
      expect(result.totalGeral).toBe(45);
    });
  });

  describe('getPedidos', () => {
    it('retorna contagem e resumo por status', async () => {
      mockPrisma.pedido.count.mockResolvedValue(5);
      mockPrisma.pedido.findMany.mockResolvedValue([]);
      mockPrisma.pedido.aggregate.mockResolvedValue({ _sum: { valorTotal: 1000 } });
      mockPrisma.pedido.groupBy.mockResolvedValue([
        { status: 'APROVADO', _count: { id: 3 } },
        { status: 'PENDENTE', _count: { id: 2 } },
      ]);

      const result = await service.getPedidos(ctx, { periodo: 'ate_hoje' });

      expect(result.total).toBe(5);
      expect(result.porStatus).toHaveLength(2);
    });
  });
});
