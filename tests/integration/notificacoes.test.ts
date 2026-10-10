import { randomBytes } from 'node:crypto';
import { Server } from 'node:http';
import webpush from 'web-push';
import prisma from '../../src/utils/prisma';
import app from '../../src/app';
import { signToken } from '../../src/utils/jwt';
import { ensureDefaultUserGroup } from '../../src/services/permissions.service';
import { publishNotificacao, subscriberCount } from '../../src/services/notification-events';
import { processarLembretesPendentes } from '../../src/services/agenda.service';

const suite = process.env.RUN_BILLING_INTEGRATION === '1' ? describe : describe.skip;

suite('Notificações: lote, tempo real e Web Push (HTTP + PostgreSQL)', () => {
  let server: Server;
  let base: string;
  let alice: { id: string; token: string };
  let bob: { id: string; token: string };

  async function call(method: string, path: string, token: string, body?: unknown) {
    const response = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: (await response.json()) as any };
  }
  async function notificar(userId: string, titulo: string) {
    return prisma.notificacao.create({
      data: { userId, tipo: 'AGENDA_LEMBRETE', titulo, mensagem: 'Lembrete de teste' },
    });
  }
  async function openStream(token: string) {
    const controller = new AbortController();
    const response = await fetch(base + '/notificacoes/stream', {
      headers: { Authorization: 'Bearer ' + token },
      signal: controller.signal,
    });
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let text = '';
    async function waitFor(fragment: string, timeoutMs = 3000) {
      const deadline = Date.now() + timeoutMs;
      while (!text.includes(fragment)) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) return false;
        const chunk = await Promise.race([
          reader.read(),
          new Promise<null>((r) => setTimeout(() => r(null), remaining)),
        ]);
        if (!chunk || chunk.done) return text.includes(fragment);
        text += decoder.decode(chunk.value, { stream: true });
      }
      return true;
    }
    return { response, waitFor, received: () => text, close: () => controller.abort() };
  }

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL || '');
    if (url.hostname !== '127.0.0.1' || url.pathname !== '/zentra_billing_test')
      throw new Error('Refusing non-test database');
    Object.assign(process.env, {
      JWT_SECRET: randomBytes(32).toString('hex'),
      BILLING_ENABLED: 'false',
      VAPID_PUBLIC_KEY: 'test-public-key',
      VAPID_PRIVATE_KEY: 'test-private-key',
      VAPID_SUBJECT: 'mailto:contato@zentra.test',
    });
    server = app.listen(0, '127.0.0.1');
    await new Promise<void>((r) => server.once('listening', r));
    const address = server.address();
    base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/api`;
  });

  beforeEach(async () => {
    jest.restoreAllMocks();
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User", "GrupoPermissao" CASCADE');
    const grupo = await ensureDefaultUserGroup();
    const create = async (email: string) => {
      const user = await prisma.user.create({
        data: { email, nome: email, senha: 'unused', grupoPermissaoId: grupo.id },
      });
      return { id: user.id, token: signToken({ userId: user.id, email }) };
    };
    alice = await create('alice@example.test');
    bob = await create('bob@example.test');
  });

  afterAll(async () => {
    await new Promise<void>((r) => server?.close(() => r()));
    await prisma.$disconnect();
  });

  test('lista lidas e não lidas com o total de não lidas', async () => {
    await notificar(alice.id, 'A1');
    const lida = await notificar(alice.id, 'A2');
    await call('PATCH', `/notificacoes/${lida.id}/lida`, alice.token);
    const { status, body } = await call('GET', '/notificacoes', alice.token);
    expect(status).toBe(200);
    expect(body.data).toHaveLength(2);
    expect(body.meta.naoLidas).toBe(1);
    expect(body.data.find((n: { id: string }) => n.id === lida.id).lida).toBe(true);
  });

  test('marcar todas como lidas afeta só o usuário autenticado, em uma operação', async () => {
    await notificar(alice.id, 'A1');
    await notificar(alice.id, 'A2');
    await notificar(bob.id, 'B1');
    const result = await call('PATCH', '/notificacoes/lidas', alice.token);
    expect(result.body.data.atualizadas).toBe(2);
    expect((await call('GET', '/notificacoes/contagem', alice.token)).body.data.count).toBe(0);
    expect((await call('GET', '/notificacoes', alice.token)).body.data).toHaveLength(2);
    expect((await call('GET', '/notificacoes/contagem', bob.token)).body.data.count).toBe(1);
  });

  test('remover todas arquiva (não apaga) só as do usuário e zera o contador', async () => {
    await notificar(alice.id, 'A1');
    await notificar(alice.id, 'A2');
    await notificar(bob.id, 'B1');
    const result = await call('DELETE', '/notificacoes', alice.token);
    expect(result.body.data.removidas).toBe(2);
    expect((await call('GET', '/notificacoes', alice.token)).body).toMatchObject({
      data: [],
      meta: { naoLidas: 0 },
    });
    // Kept for the jobs' duplicate checks.
    expect(await prisma.notificacao.count({ where: { userId: alice.id, arquivadaEm: { not: null } } })).toBe(2);
    expect((await call('GET', '/notificacoes', bob.token)).body.data).toHaveLength(1);
  });

  test('não é possível ler ou remover notificação de outro usuário pelo id', async () => {
    const deBob = await notificar(bob.id, 'B1');
    expect((await call('PATCH', `/notificacoes/${deBob.id}/lida`, alice.token)).status).toBe(404);
    expect((await call('DELETE', `/notificacoes/${deBob.id}`, alice.token)).status).toBe(404);
    expect(await prisma.notificacao.findUniqueOrThrow({ where: { id: deBob.id } })).toMatchObject({
      lida: false,
      arquivadaEm: null,
    });
  });

  test('stream entrega a nova notificação só ao dono e libera o listener ao fechar', async () => {
    const streamAlice = await openStream(alice.token);
    const streamBob = await openStream(bob.token);
    expect(streamAlice.response.headers.get('content-type')).toContain('text/event-stream');
    expect(await streamAlice.waitFor(': conectado')).toBe(true);
    expect(await streamBob.waitFor(': conectado')).toBe(true);
    expect(subscriberCount(alice.id)).toBe(1);

    const nova = await notificar(alice.id, 'Nova');
    publishNotificacao(nova);

    expect(await streamAlice.waitFor(`"id":"${nova.id}"`)).toBe(true);
    expect(streamAlice.received()).toContain('event: created');
    expect(await streamBob.waitFor(nova.id, 300)).toBe(false);

    streamAlice.close();
    streamBob.close();
    await new Promise((r) => setTimeout(r, 100));
    expect(subscriberCount(alice.id)).toBe(0);
    expect(subscriberCount(bob.id)).toBe(0);
  });

  test('o job de lembretes publica a notificação criada exatamente uma vez', async () => {
    const stream = await openStream(alice.token);
    await stream.waitFor(': conectado');
    await prisma.lembrete.create({
      data: {
        userId: alice.id,
        titulo: 'Ligar para cliente',
        dataReferencia: new Date().toISOString().slice(0, 10),
        agendadoPara: new Date(Date.now() - 1000),
      },
    });
    expect(await processarLembretesPendentes()).toBe(1);
    expect(await processarLembretesPendentes()).toBe(0);
    expect(await stream.waitFor('event: created')).toBe(true);
    await new Promise((r) => setTimeout(r, 200));
    expect(stream.received().match(/event: created/g)).toHaveLength(1);
    stream.close();
  });

  test('inscrição de push recusa destinos fora dos serviços de push e troca de dono no mesmo aparelho', async () => {
    const keys = { p256dh: 'BPublicKeyBase64url', auth: 'AuthSecret' };
    const evil = await call('POST', '/push/inscricoes', alice.token, {
      endpoint: 'https://169.254.169.254/latest/meta-data',
      keys,
    });
    expect(evil.status).toBe(422);

    const endpoint = 'https://fcm.googleapis.com/fcm/send/device-1';
    expect((await call('POST', '/push/inscricoes', alice.token, { endpoint, keys })).status).toBe(201);
    expect((await call('POST', '/push/inscricoes', bob.token, { endpoint, keys })).status).toBe(201);
    expect(await prisma.pushSubscription.findUniqueOrThrow({ where: { endpoint } })).toMatchObject({
      userId: bob.id,
    });
    // Alice cannot remove a device that now belongs to Bob.
    await call('DELETE', '/push/inscricoes', alice.token, { endpoint });
    expect(await prisma.pushSubscription.count()).toBe(1);
    expect((await call('GET', '/push/chave', bob.token)).body.data.publicKey).toBe('test-public-key');
  });

  test('nova notificação vira push para os aparelhos do dono', async () => {
    const send = jest.spyOn(webpush, 'sendNotification').mockResolvedValue({
      statusCode: 201,
      body: '',
      headers: {},
    });
    await prisma.pushSubscription.create({
      data: {
        userId: alice.id,
        endpoint: 'https://fcm.googleapis.com/fcm/send/alice',
        p256dh: 'k',
        auth: 'a',
      },
    });
    const nova = await notificar(alice.id, 'Pedido aceito');
    publishNotificacao(nova);
    await new Promise((r) => setTimeout(r, 200));
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].endpoint).toBe('https://fcm.googleapis.com/fcm/send/alice');
    expect(JSON.parse(String(send.mock.calls[0][1]))).toMatchObject({
      id: nova.id,
      tag: `zentra-notificacao-${nova.id}`,
      url: '/home#notificacoes',
    });
  });
});
