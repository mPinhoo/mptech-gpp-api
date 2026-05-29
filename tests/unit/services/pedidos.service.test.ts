const USER_ID = 'user-1';

interface MockPrismaModel {
  findMany: jest.Mock;
  findFirst: jest.Mock;
  findUnique: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  count: jest.Mock;
  aggregate: jest.Mock;
  deleteMany: jest.Mock;
}

const pedido: MockPrismaModel = {
  findMany: jest.fn(),
  findFirst: jest.fn(),
  findUnique: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  count: jest.fn(),
  aggregate: jest.fn(),
  deleteMany: jest.fn(),
};

const produto: Pick<MockPrismaModel, 'findMany'> = {
  findMany: jest.fn(),
};

const cliente: Pick<MockPrismaModel, 'findFirst'> = {
  findFirst: jest.fn(),
};

const itemPedido: Pick<MockPrismaModel, 'deleteMany'> = {
  deleteMany: jest.fn(),
};

const extraPedido: Pick<MockPrismaModel, 'deleteMany'> = {
  deleteMany: jest.fn(),
};

const mockPrisma = {
  pedido,
  produto,
  cliente,
  itemPedido,
  extraPedido,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $transaction: jest.fn((fn: (prisma: any) => unknown) => fn({
    pedido, produto, cliente, itemPedido, extraPedido,
  })),
};

jest.mock('@/utils/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

import { PedidosService } from '@/services/pedidos.service';
import { NotFoundError, AppError } from '@/utils/errors';

describe('PedidosService', () => {
  let service: PedidosService;

  beforeEach(() => {
    service = new PedidosService();
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('deve retornar pedidos formatados para o frontend', async () => {
      const pedidos = [
        {
          id: '1', numero: '#001', cliente: { nome: 'João' },
          dataPedido: new Date(2026, 4, 26), valorTotal: { toString: () => '1250.00' },
          status: 'CONCLUIDO',
        },
      ];
      mockPrisma.pedido.findMany.mockResolvedValue(pedidos);
      mockPrisma.pedido.count.mockResolvedValue(1);

      const result = await service.findAll(USER_ID, {});

      expect(result.data[0].cliente).toBe('João');
      expect(result.data[0].data).toBe('26/05/2026');
      expect(result.data[0].status).toBe('Concluído');
      expect(result.data[0].valor).toContain('R$');
    });
  });

  describe('findById', () => {
    it('deve lançar NotFoundError se pedido não existe', async () => {
      mockPrisma.pedido.findFirst.mockResolvedValue(null);

      await expect(service.findById(USER_ID, 'invalid')).rejects.toThrow(NotFoundError);
    });
  });

  describe('create', () => {
    it('deve lançar NotFoundError se cliente não existe', async () => {
      mockPrisma.cliente.findFirst.mockResolvedValue(null);

      await expect(service.create(USER_ID, {
        clienteId: 'invalid',
        dataPedido: '2026-05-26',
        prazoEntrega: '2026-06-01',
        itens: [{ produtoId: 'p1', quantidade: 1 }],
        extras: [],
      })).rejects.toThrow(NotFoundError);
    });

    it('deve lançar erro se produto não encontrado', async () => {
      mockPrisma.cliente.findFirst.mockResolvedValue({ id: 'c1', ativo: true });
      mockPrisma.produto.findMany.mockResolvedValue([]);

      await expect(service.create(USER_ID, {
        clienteId: 'c1',
        dataPedido: '2026-05-26',
        prazoEntrega: '2026-06-01',
        itens: [{ produtoId: 'invalid', quantidade: 1 }],
        extras: [],
      })).rejects.toThrow(AppError);
    });
  });

  describe('updateStatus', () => {
    it('deve lançar NotFoundError se pedido não existe', async () => {
      mockPrisma.pedido.findFirst.mockResolvedValue(null);

      await expect(service.updateStatus(USER_ID, 'invalid', 'APROVADO')).rejects.toThrow(NotFoundError);
    });
  });

  describe('enviar', () => {
    it('deve lançar NotFoundError se pedido não existe', async () => {
      mockPrisma.pedido.findFirst.mockResolvedValue(null);

      await expect(service.enviar(USER_ID, 'invalid')).rejects.toThrow(NotFoundError);
    });
  });
});
