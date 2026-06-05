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

jest.mock('@/utils/similarity', () => ({
  findClienteIdsBySimilarName: jest.fn(),
}));

import { PedidosService } from '@/services/pedidos.service';
import { NotFoundError, AppError } from '@/utils/errors';
import { findClienteIdsBySimilarName } from '@/utils/similarity';

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

    it('deve aplicar filtros de numero, cliente, status e data', async () => {
      (findClienteIdsBySimilarName as jest.Mock).mockResolvedValue(['cliente-1']);
      mockPrisma.pedido.findMany.mockResolvedValue([]);
      mockPrisma.pedido.count.mockResolvedValue(0);

      await service.findAll(USER_ID, {
        numero: 'PED-0001',
        cliente: 'João',
        status: 'APROVADO',
        dataDe: '2026-05-01',
        dataAte: '2026-05-31',
      });

      expect(findClienteIdsBySimilarName).toHaveBeenCalledWith(USER_ID, 'João');
      expect(mockPrisma.pedido.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: USER_ID,
            numero: { contains: 'PED-0001', mode: 'insensitive' },
            clienteId: { in: ['cliente-1'] },
            status: 'APROVADO',
            dataPedido: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        })
      );
    });

    it('deve retornar vazio quando cliente similar não for encontrado', async () => {
      (findClienteIdsBySimilarName as jest.Mock).mockResolvedValue([]);

      const result = await service.findAll(USER_ID, { cliente: 'Inexistente' });

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(mockPrisma.pedido.findMany).not.toHaveBeenCalled();
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

  describe('update', () => {
    const pedidoBase = {
      id: 'pedido-1',
      userId: USER_ID,
      numero: 'PED-0001',
      status: 'APROVADO',
      linkToken: 'token-123',
      enviadoCliente: true,
      dataPedido: new Date(),
      prazoEntrega: new Date(),
      valorTotal: { toString: () => '100' },
      itens: [{ subtotal: { toString: () => '100' } }],
      extras: [],
      cliente: { id: 'c1', nome: 'Cliente' },
    };

    it('deve voltar para PENDENTE e manter linkToken ao editar pedido aprovado', async () => {
      mockPrisma.pedido.findFirst
        .mockResolvedValueOnce({ ...pedidoBase, itens: [], extras: [] })
        .mockResolvedValueOnce({
          ...pedidoBase,
          status: 'PENDENTE',
          linkToken: 'token-123',
          itens: [],
          extras: [],
        });
      mockPrisma.pedido.update.mockResolvedValue({});
      mockPrisma.produto.findMany.mockResolvedValue([
        { id: 'p1', preco: { toString: () => '100' } },
      ]);

      await service.update(USER_ID, 'pedido-1', {
        itens: [{ produtoId: 'p1', quantidade: 1 }],
        extras: [],
      });

      expect(mockPrisma.pedido.update).toHaveBeenCalledWith({
        where: { id: 'pedido-1' },
        data: expect.objectContaining({
          status: 'PENDENTE',
          kanbanColunaId: null,
        }),
      });
      const updateCall = mockPrisma.pedido.update.mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty('linkToken');
    });

    it('deve rejeitar edição de pedido concluído', async () => {
      mockPrisma.pedido.findFirst.mockResolvedValue({
        ...pedidoBase,
        status: 'CONCLUIDO',
        itens: [],
        extras: [],
      });

      await expect(
        service.update(USER_ID, 'pedido-1', {
          dataPedido: '2026-06-01',
        })
      ).rejects.toThrow(AppError);
    });
  });

  describe('updateStatus', () => {
    it('deve lançar NotFoundError se pedido não existe', async () => {
      mockPrisma.pedido.findFirst.mockResolvedValue(null);

      await expect(service.updateStatus(USER_ID, 'invalid', 'APROVADO')).rejects.toThrow(NotFoundError);
    });

    it('deve apagar linkToken ao sair do status APROVADO', async () => {
      mockPrisma.pedido.findFirst.mockResolvedValue({
        id: 'pedido-1',
        status: 'APROVADO',
        linkToken: 'token-123',
      });
      mockPrisma.pedido.update.mockResolvedValue({});
      mockPrisma.pedido.findFirst
        .mockResolvedValueOnce({
          id: 'pedido-1',
          status: 'APROVADO',
          linkToken: 'token-123',
        })
        .mockResolvedValueOnce({
          id: 'pedido-1',
          numero: 'PED-0001',
          status: 'CONCLUIDO',
          linkToken: null,
          enviadoCliente: true,
          dataPedido: new Date(),
          prazoEntrega: new Date(),
          valorTotal: { toString: () => '100' },
          cliente: { id: 'c1', nome: 'Cliente' },
          itens: [],
          extras: [],
        });

      await service.updateStatus(USER_ID, 'pedido-1', 'CONCLUIDO');

      expect(mockPrisma.pedido.update).toHaveBeenCalledWith({
        where: { id: 'pedido-1' },
        data: { status: 'CONCLUIDO', linkToken: null },
      });
    });
  });

  describe('enviar', () => {
    it('deve lançar NotFoundError se pedido não existe', async () => {
      mockPrisma.pedido.findFirst.mockResolvedValue(null);

      await expect(service.enviar(USER_ID, 'invalid')).rejects.toThrow(NotFoundError);
    });
  });
});
