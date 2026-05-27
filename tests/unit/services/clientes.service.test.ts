const mockPrisma = {
  cliente: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
};

jest.mock('@/utils/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

import { ClientesService } from '@/services/clientes.service';
import { NotFoundError } from '@/utils/errors';

describe('ClientesService', () => {
  let service: ClientesService;

  beforeEach(() => {
    service = new ClientesService();
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('deve retornar lista de clientes', async () => {
      const clientes = [
        { id: '1', nome: 'João', email: 'j@t.com', telefone: '11999', documento: '123', endereco: 'Rua A' },
      ];
      mockPrisma.cliente.findMany.mockResolvedValue(clientes);
      mockPrisma.cliente.count.mockResolvedValue(1);

      const result = await service.findAll({});

      expect(result.data).toHaveLength(1);
      expect(result.data[0].nome).toBe('João');
    });
  });

  describe('findById', () => {
    it('deve retornar cliente com pedidos', async () => {
      const cliente = {
        id: '1', nome: 'João', email: 'j@t.com', telefone: '11', documento: '123', endereco: 'Rua', ativo: true,
        pedidos: [{ id: 'p1', numero: '#001', dataPedido: new Date(), status: 'PENDENTE', valorTotal: { toNumber: () => 100 }, itens: [] }],
      };
      mockPrisma.cliente.findUnique.mockResolvedValue(cliente);

      const result = await service.findById('1');
      expect(result.nome).toBe('João');
    });

    it('deve lançar NotFoundError se cliente não existe', async () => {
      mockPrisma.cliente.findUnique.mockResolvedValue(null);

      await expect(service.findById('invalid')).rejects.toThrow(NotFoundError);
    });

    it('deve lançar NotFoundError se cliente inativo', async () => {
      mockPrisma.cliente.findUnique.mockResolvedValue({ id: '1', ativo: false, pedidos: [] });

      await expect(service.findById('1')).rejects.toThrow(NotFoundError);
    });
  });

  describe('create', () => {
    it('deve criar cliente', async () => {
      const created = { id: '1', nome: 'Novo', email: 'n@t.com', telefone: null, documento: null, endereco: null };
      mockPrisma.cliente.create.mockResolvedValue(created);

      const result = await service.create({ nome: 'Novo', email: 'n@t.com' });
      expect(result.nome).toBe('Novo');
    });
  });

  describe('delete (soft)', () => {
    it('deve desativar cliente', async () => {
      mockPrisma.cliente.findUnique.mockResolvedValue({ id: '1', ativo: true });
      mockPrisma.cliente.update.mockResolvedValue({ id: '1', ativo: false });

      await service.delete('1');
      expect(mockPrisma.cliente.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { ativo: false },
      });
    });

    it('deve lançar NotFoundError se cliente não existe', async () => {
      mockPrisma.cliente.findUnique.mockResolvedValue(null);

      await expect(service.delete('invalid')).rejects.toThrow(NotFoundError);
    });
  });
});
