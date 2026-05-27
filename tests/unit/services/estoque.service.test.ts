const mockPrisma = {
  estoque: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
};

jest.mock('@/utils/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

import { EstoqueService } from '@/services/estoque.service';
import { NotFoundError, AppError } from '@/utils/errors';

describe('EstoqueService', () => {
  let service: EstoqueService;

  beforeEach(() => {
    service = new EstoqueService();
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('deve retornar itens de estoque com status calculado', async () => {
      const itens = [
        { id: '1', produto: { nome: 'Prod A' }, quantidade: 50, quantidadeMinima: 10, unidade: 'un' },
        { id: '2', produto: { nome: 'Prod B' }, quantidade: 5, quantidadeMinima: 10, unidade: 'un' },
        { id: '3', produto: { nome: 'Prod C' }, quantidade: 0, quantidadeMinima: 5, unidade: 'un' },
      ];
      mockPrisma.estoque.findMany.mockResolvedValue(itens);
      mockPrisma.estoque.count.mockResolvedValue(3);

      const result = await service.findAll({});

      expect(result.data[0].status).toBe('Normal');
      expect(result.data[1].status).toBe('Baixo');
      expect(result.data[2].status).toBe('Crítico');
    });
  });

  describe('entrada', () => {
    it('deve incrementar quantidade no estoque', async () => {
      mockPrisma.estoque.findUnique.mockResolvedValue({ id: '1', produtoId: 'p1', quantidade: 10 });
      mockPrisma.estoque.update.mockResolvedValue({
        id: '1', produto: { nome: 'Prod' }, quantidade: 15, quantidadeMinima: 5, unidade: 'un',
      });

      const result = await service.entrada({ produtoId: 'p1', quantidade: 5 });
      expect(result.quantidade).toBe(15);
    });

    it('deve lançar NotFoundError se estoque não existe', async () => {
      mockPrisma.estoque.findUnique.mockResolvedValue(null);

      await expect(service.entrada({ produtoId: 'invalid', quantidade: 5 }))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('saida', () => {
    it('deve decrementar quantidade no estoque', async () => {
      mockPrisma.estoque.findUnique.mockResolvedValue({ id: '1', produtoId: 'p1', quantidade: 10 });
      mockPrisma.estoque.update.mockResolvedValue({
        id: '1', produto: { nome: 'Prod' }, quantidade: 7, quantidadeMinima: 5, unidade: 'un',
      });

      const result = await service.saida({ produtoId: 'p1', quantidade: 3 });
      expect(result.quantidade).toBe(7);
    });

    it('deve lançar erro se quantidade insuficiente', async () => {
      mockPrisma.estoque.findUnique.mockResolvedValue({ id: '1', produtoId: 'p1', quantidade: 2 });

      await expect(service.saida({ produtoId: 'p1', quantidade: 5 }))
        .rejects.toThrow(AppError);
    });
  });
});
