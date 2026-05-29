const USER_ID = 'user-1';

const mockPrisma = {
  produto: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
};

jest.mock('@/utils/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

import { ProdutosService } from '@/services/produtos.service';
import { NotFoundError } from '@/utils/errors';

describe('ProdutosService', () => {
  let service: ProdutosService;

  beforeEach(() => {
    service = new ProdutosService();
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('deve retornar lista de produtos com paginação', async () => {
      const produtos = [
        { id: '1', nome: 'Produto 1', categoria: 'Cat', preco: { toNumber: () => 49.9 }, status: 'ATIVO' },
      ];
      mockPrisma.produto.findMany.mockResolvedValue(produtos);
      mockPrisma.produto.count.mockResolvedValue(1);

      const result = await service.findAll(USER_ID, { page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('deve aplicar filtro de busca', async () => {
      mockPrisma.produto.findMany.mockResolvedValue([]);
      mockPrisma.produto.count.mockResolvedValue(0);

      await service.findAll(USER_ID, { search: 'camiseta' });

      expect(mockPrisma.produto.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.any(Array),
          }),
        })
      );
    });
  });

  describe('findById', () => {
    it('deve retornar produto quando encontrado', async () => {
      const produto = {
        id: '1', nome: 'Produto', categoria: 'Cat', descricao: null,
        tempoProducao: { toNumber: () => 1 }, margemLucro: { toNumber: () => 0 },
        preco: { toNumber: () => 99 }, status: 'ATIVO', materiais: [],
      };
      mockPrisma.produto.findFirst.mockResolvedValue(produto);

      const result = await service.findById(USER_ID, '1');
      expect(result.nome).toBe('Produto');
    });

    it('deve lançar NotFoundError quando não encontrado', async () => {
      mockPrisma.produto.findFirst.mockResolvedValue(null);

      await expect(service.findById(USER_ID, 'invalid')).rejects.toThrow(NotFoundError);
    });
  });

  describe('create', () => {
    it('deve criar um produto e retornar formatado', async () => {
      const produto = {
        id: '1', nome: 'Novo', categoria: 'Cat', descricao: null,
        tempoProducao: { toNumber: () => 1 }, margemLucro: { toNumber: () => 0 },
        preco: { toNumber: () => 29.9 }, status: 'ATIVO', materiais: [],
      };
      mockPrisma.produto.create.mockResolvedValue({ id: '1' });
      mockPrisma.produto.findFirst.mockResolvedValue(produto);

      const result = await service.create(USER_ID, {
        nome: 'Novo', categoria: 'Outros', preco: 29.9, tempoProducao: 1, margemLucro: 0,
        status: 'ATIVO', materiais: [],
      });
      expect(result.nome).toBe('Novo');
    });
  });

  describe('delete (soft)', () => {
    it('deve desativar o produto', async () => {
      mockPrisma.produto.findFirst.mockResolvedValue({
        id: '1', nome: 'X', categoria: 'C', descricao: null,
        tempoProducao: { toNumber: () => 1 }, margemLucro: { toNumber: () => 0 },
        preco: { toNumber: () => 10 }, status: 'ATIVO', materiais: [],
      });
      mockPrisma.produto.update.mockResolvedValue({ id: '1', status: 'INATIVO' });

      await service.delete(USER_ID, '1');
      expect(mockPrisma.produto.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { status: 'INATIVO' },
      });
    });
  });
});
