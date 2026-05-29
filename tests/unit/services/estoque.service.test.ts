const USER_ID = 'user-1';

const mockPrisma = {
  materiaPrima: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  despesa: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
  $queryRaw: jest.fn(),
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
        { id: '1', nome: 'Prod A', quantidade: 50, quantidadeMinima: 10, unidade: 'un', precoCusto: { toNumber: () => 10 } },
        { id: '2', nome: 'Prod B', quantidade: 5, quantidadeMinima: 10, unidade: 'un', precoCusto: { toNumber: () => 10 } },
        { id: '3', nome: 'Prod C', quantidade: 0, quantidadeMinima: 5, unidade: 'un', precoCusto: { toNumber: () => 10 } },
      ];
      mockPrisma.materiaPrima.findMany.mockResolvedValue(itens);
      mockPrisma.materiaPrima.count.mockResolvedValue(3);

      const result = await service.findAll(USER_ID, {});

      expect(result.data[0].status).toBe('Normal');
      expect(result.data[1].status).toBe('Baixo');
      expect(result.data[2].status).toBe('Crítico');
    });

    it('deve aplicar filtro de material', async () => {
      mockPrisma.materiaPrima.findMany.mockResolvedValue([]);
      mockPrisma.materiaPrima.count.mockResolvedValue(0);

      await service.findAll(USER_ID, { material: 'Papel' });

      expect(mockPrisma.materiaPrima.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: USER_ID,
            nome: { contains: 'Papel', mode: 'insensitive' },
          }),
        })
      );
    });

    it('deve aplicar filtro de status', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ id: '1' }]);
      mockPrisma.materiaPrima.findMany.mockResolvedValue([]);
      mockPrisma.materiaPrima.count.mockResolvedValue(0);

      await service.findAll(USER_ID, { status: 'Baixo' });

      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
      expect(mockPrisma.materiaPrima.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: USER_ID,
            id: { in: ['1'] },
          }),
        })
      );
    });

    it('deve retornar vazio quando status não encontrar materiais', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const result = await service.findAll(USER_ID, { status: 'Normal' });

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(mockPrisma.materiaPrima.findMany).not.toHaveBeenCalled();
    });
  });

  describe('entrada', () => {
    it('deve incrementar quantidade no estoque', async () => {
      mockPrisma.materiaPrima.findFirst.mockResolvedValue({
        id: '1', nome: 'Prod', quantidade: 10, quantidadeMinima: 5, unidade: 'un', precoCusto: { toNumber: () => 2 },
      });
      mockPrisma.$transaction.mockResolvedValue([
        { id: '1', nome: 'Prod', quantidade: 15, quantidadeMinima: 5, unidade: 'un', precoCusto: { toNumber: () => 2 } },
      ]);

      const result = await service.entrada(USER_ID, { materiaPrimaId: '1', quantidade: 5 });
      expect(result.quantidade).toBe(15);
    });

    it('deve lançar NotFoundError se estoque não existe', async () => {
      mockPrisma.materiaPrima.findFirst.mockResolvedValue(null);

      await expect(service.entrada(USER_ID, { materiaPrimaId: 'invalid', quantidade: 5 }))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('saida', () => {
    it('deve decrementar quantidade no estoque', async () => {
      mockPrisma.materiaPrima.findFirst.mockResolvedValue({
        id: '1', nome: 'Prod', quantidade: 10, quantidadeMinima: 5, unidade: 'un', precoCusto: { toNumber: () => 2 },
      });
      mockPrisma.materiaPrima.update.mockResolvedValue({
        id: '1', nome: 'Prod', quantidade: 7, quantidadeMinima: 5, unidade: 'un', precoCusto: { toNumber: () => 2 },
      });

      const result = await service.saida(USER_ID, { materiaPrimaId: '1', quantidade: 3 });
      expect(result.quantidade).toBe(7);
    });

    it('deve lançar erro se quantidade insuficiente', async () => {
      mockPrisma.materiaPrima.findFirst.mockResolvedValue({
        id: '1', nome: 'Prod', quantidade: 2, quantidadeMinima: 5, unidade: 'un', precoCusto: { toNumber: () => 2 },
      });

      await expect(service.saida(USER_ID, { materiaPrimaId: '1', quantidade: 5 }))
        .rejects.toThrow(AppError);
    });
  });
});
