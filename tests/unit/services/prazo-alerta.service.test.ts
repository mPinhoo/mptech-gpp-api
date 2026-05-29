const mockPrisma = {
  pedido: {
    findMany: jest.fn(),
  },
  notificacao: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
};

jest.mock('@/utils/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

import { processarAlertasPrazoPedidos } from '@/services/prazo-alerta.service';

describe('processarAlertasPrazoPedidos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deve criar notificação para pedido em alerta de prazo', async () => {
    const prazo = new Date('2099-06-05T12:00:00');
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2099-06-02T12:00:00'));

    mockPrisma.pedido.findMany.mockResolvedValue([
      {
        id: 'p1',
        userId: 'u1',
        numero: '#PED-0001',
        prazoEntrega: prazo,
        cliente: { nome: 'João' },
        kanbanColuna: { nome: 'Aguardando Produção' },
      },
    ]);
    mockPrisma.notificacao.findFirst.mockResolvedValue(null);
    mockPrisma.notificacao.create.mockResolvedValue({ id: 'n1' });

    const created = await processarAlertasPrazoPedidos();

    expect(created).toBe(1);
    expect(mockPrisma.notificacao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tipo: 'PEDIDO_PRAZO_ALERTA',
          pedidoId: 'p1',
        }),
      })
    );

    jest.useRealTimers();
  });

  it('não deve duplicar notificação no mesmo dia', async () => {
    mockPrisma.pedido.findMany.mockResolvedValue([
      {
        id: 'p1',
        userId: 'u1',
        numero: '#PED-0001',
        prazoEntrega: new Date('2099-06-05T12:00:00'),
        cliente: { nome: 'João' },
        kanbanColuna: { nome: 'Em Produção' },
      },
    ]);
    mockPrisma.notificacao.findFirst.mockResolvedValue({ id: 'existing' });

    const created = await processarAlertasPrazoPedidos();

    expect(created).toBe(0);
    expect(mockPrisma.notificacao.create).not.toHaveBeenCalled();
  });
});
