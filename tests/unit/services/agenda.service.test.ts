const USER_ID = 'user-1';

const mockPrisma = {
  lembrete: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  notificacao: {
    create: jest.fn(),
  },
  $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
};

jest.mock('@/utils/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

import { AgendaService, processarLembretesPendentes } from '@/services/agenda.service';
import { NotFoundError } from '@/utils/errors';

describe('AgendaService', () => {
  let service: AgendaService;

  beforeEach(() => {
    service = new AgendaService();
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('deve criar lembrete quando abaixo do limite diário', async () => {
      mockPrisma.lembrete.count.mockResolvedValue(2);
      mockPrisma.lembrete.create.mockResolvedValue({
        id: '1',
        titulo: 'Reunião',
        descricao: null,
        dataReferencia: '2099-12-31',
        agendadoPara: new Date('2099-12-31T10:00:00'),
        notificado: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.create(USER_ID, {
        titulo: 'Reunião',
        data: '2099-12-31',
        horario: '10:00',
      });

      expect(result.titulo).toBe('Reunião');
      expect(mockPrisma.lembrete.create).toHaveBeenCalled();
    });

    it('deve bloquear quando atingir 5 lembretes no dia', async () => {
      mockPrisma.lembrete.count.mockResolvedValue(5);

      await expect(
        service.create(USER_ID, {
          titulo: 'Extra',
          data: '2099-12-31',
          horario: '11:00',
        })
      ).rejects.toThrow('Limite de 5 lembretes por dia atingido');
    });
  });

  describe('delete', () => {
    it('deve lançar NotFoundError se lembrete não existe', async () => {
      mockPrisma.lembrete.findFirst.mockResolvedValue(null);

      await expect(service.delete(USER_ID, 'invalid')).rejects.toThrow(NotFoundError);
    });
  });

  describe('processarLembretesPendentes', () => {
    it('deve criar notificação e marcar lembrete como notificado', async () => {
      mockPrisma.lembrete.findMany.mockResolvedValue([
        {
          id: '1',
          userId: USER_ID,
          titulo: 'Ligar cliente',
          descricao: 'Retorno',
          agendadoPara: new Date('2020-01-01T09:00:00'),
        },
      ]);

      const processed = await processarLembretesPendentes();

      expect(processed).toBe(1);
      expect(mockPrisma.notificacao.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tipo: 'AGENDA_LEMBRETE',
            titulo: 'Ligar cliente',
          }),
        })
      );
    });
  });
});
