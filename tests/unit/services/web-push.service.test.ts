const mockPrisma = {
  pushSubscription: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
};

jest.mock('@/utils/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

jest.mock('web-push', () => ({
  __esModule: true,
  default: { sendNotification: jest.fn() },
}));

import webpush from 'web-push';
import {
  isPushServiceEndpoint,
  notificacaoPath,
  pushPublicKey,
  sendWebPush,
} from '@/services/web-push.service';

const ORIGINAL_ENV = process.env;
const notificacao = {
  id: 'n1',
  userId: 'u1',
  tipo: 'PEDIDO_APROVADO',
  titulo: 'Pedido aceito pelo cliente',
  mensagem: 'João aceitou o pedido #PED-0001.',
  pedidoId: 'p1',
  lembreteId: null,
};
const subscription = (id: string) => ({
  id,
  userId: 'u1',
  endpoint: `https://fcm.googleapis.com/fcm/send/${id}`,
  p256dh: 'BKey',
  auth: 'authKey',
});

beforeEach(() => {
  process.env = {
    ...ORIGINAL_ENV,
    VAPID_PUBLIC_KEY: 'public-key',
    VAPID_PRIVATE_KEY: 'private-key',
    VAPID_SUBJECT: 'mailto:contato@zentra.test',
  };
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('isPushServiceEndpoint', () => {
  it('aceita apenas os serviços de push dos navegadores', () => {
    expect(isPushServiceEndpoint('https://fcm.googleapis.com/fcm/send/abc')).toBe(true);
    expect(isPushServiceEndpoint('https://updates.push.services.mozilla.com/wpush/v2/abc')).toBe(true);
    expect(isPushServiceEndpoint('https://web.push.apple.com/abc')).toBe(true);
    expect(isPushServiceEndpoint('https://wns2-bl2p.notify.windows.com/w/?token=abc')).toBe(true);
  });

  it('recusa destinos que transformariam o cadastro em SSRF', () => {
    expect(isPushServiceEndpoint('http://fcm.googleapis.com/fcm/send/abc')).toBe(false);
    expect(isPushServiceEndpoint('https://169.254.169.254/latest/meta-data')).toBe(false);
    expect(isPushServiceEndpoint('https://localhost/push')).toBe(false);
    expect(isPushServiceEndpoint('https://fcm.googleapis.com.evil.test/x')).toBe(false);
    expect(isPushServiceEndpoint('https://user:pass@fcm.googleapis.com/x')).toBe(false);
    expect(isPushServiceEndpoint('https://fcm.googleapis.com:8443/x')).toBe(false);
    expect(isPushServiceEndpoint('não é url')).toBe(false);
  });
});

describe('sendWebPush', () => {
  it('não faz nada enquanto o VAPID não está configurado', async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    expect(pushPublicKey()).toBeNull();
    await sendWebPush(notificacao);
    expect(mockPrisma.pushSubscription.findMany).not.toHaveBeenCalled();
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });

  it('envia para cada aparelho do usuário com tag para evitar duplicatas', async () => {
    mockPrisma.pushSubscription.findMany.mockResolvedValue([subscription('a'), subscription('b')]);
    (webpush.sendNotification as jest.Mock).mockResolvedValue({ statusCode: 201 });

    await sendWebPush(notificacao);

    expect(mockPrisma.pushSubscription.findMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    expect(webpush.sendNotification).toHaveBeenCalledTimes(2);
    const [target, payload] = (webpush.sendNotification as jest.Mock).mock.calls[0];
    expect(target).toEqual({
      endpoint: 'https://fcm.googleapis.com/fcm/send/a',
      keys: { p256dh: 'BKey', auth: 'authKey' },
    });
    expect(JSON.parse(payload)).toEqual({
      id: 'n1',
      title: 'Pedido aceito pelo cliente',
      body: 'João aceitou o pedido #PED-0001.',
      url: '/pedidos/p1',
      tag: 'zentra-notificacao-n1',
    });
  });

  it('remove inscrições expiradas e ignora falhas temporárias', async () => {
    mockPrisma.pushSubscription.findMany.mockResolvedValue([subscription('gone'), subscription('busy')]);
    (webpush.sendNotification as jest.Mock)
      .mockRejectedValueOnce(Object.assign(new Error('Gone'), { statusCode: 410 }))
      .mockRejectedValueOnce(Object.assign(new Error('Unavailable'), { statusCode: 503 }));

    await expect(sendWebPush(notificacao)).resolves.toBeUndefined();

    expect(mockPrisma.pushSubscription.deleteMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.pushSubscription.deleteMany).toHaveBeenCalledWith({ where: { id: 'gone' } });
  });
});

describe('notificacaoPath', () => {
  it('leva cada tipo para a tela correspondente', () => {
    expect(notificacaoPath({ tipo: 'PEDIDO_PRAZO_ALERTA', pedidoId: 'p1', lembreteId: null })).toBe('/area-trabalho');
    expect(notificacaoPath({ tipo: 'PEDIDO_APROVADO', pedidoId: 'p1', lembreteId: null })).toBe('/pedidos/p1');
    expect(notificacaoPath({ tipo: 'AGENDA_LEMBRETE', pedidoId: null, lembreteId: 'l1' })).toBe('/agenda');
  });
});
