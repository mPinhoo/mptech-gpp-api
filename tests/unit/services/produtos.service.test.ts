const mockPrisma = {
  produto: {
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
        { id: '1', nome: 'Produto 1', categoria: 'Cat', preco: { toNumber: () => 49.9 }, ativo: true },
      ];
      mockPrisma.produto.findMany.mockResolvedValue(produtos);
      mockPrisma.produto.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('deve aplicar filtro de busca', async () => {
      mockPrisma.produto.findMany.mockResolvedValue([]);
      mockPrisma.produto.count.mockResolvedValue(0);

      await service.findAll({ search: 'camiseta' });

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
      const produto = { id: '1', nome: 'Produto', categoria: 'Cat', preco: { toNumber: () => 99 }, ativo: true };
      mockPrisma.produto.findUnique.mockResolvedValue(produto);

      const result = await service.findById('1');
      expect(result.nome).toBe('Produto');
    });

    it('deve lançar NotFoundError quando não encontrado', async () => {
      mockPrisma.produto.findUnique.mockResolvedValue(null);

      await expect(service.findById('invalid')).rejects.toThrow(NotFoundError);
    });
  });

  describe('create', () => {
    it('deve criar um produto e retornar formatado', async () => {
      const produto = { id: '1', nome: 'Novo', categoria: 'Cat', preco: { toNumber: () => 29.9 }, ativo: true };
      mockPrisma.produto.create.mockResolvedValue(produto);

      const result = await service.create({ nome: 'Novo', categoria: 'Cat', preco: 29.9, ativo: true });
      expect(result.nome).toBe('Novo');
    });
  });

  describe('delete (soft)', () => {
    it('deve desativar o produto', async () => {
      mockPrisma.produto.findUnique.mockResolvedValue({ id: '1', nome: 'X', categoria: 'C', preco: { toNumber: () => 10 }, ativo: true });
      mockPrisma.produto.update.mockResolvedValue({ id: '1', ativo: false });

      await service.delete('1');
      expect(mockPrisma.produto.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { ativo: false },
      });
    });
  });
});
