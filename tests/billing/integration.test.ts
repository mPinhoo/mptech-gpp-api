import { randomBytes, randomUUID } from 'node:crypto';
import { Server } from 'node:http';
import bcrypt from 'bcryptjs';
import prisma from '../../src/utils/prisma';
import app from '../../src/app';
import { asaas, GatewayError, GatewayPayment } from '../../src/billing/asaas';
import { createCheckout } from '../../src/billing/checkout';
import { seedBillingPlans } from '../../src/billing/catalog';
import { reconcileCheckout } from '../../src/billing/reconcile';
import { processWebhooks, receiveWebhook } from '../../src/billing/webhooks';
import { decrypt } from '../../src/billing/security';
import { deliverOutbox } from '../../src/billing/outbox';
import { withQuota } from '../../src/billing/access';
import { hasAccess } from '../../src/billing/state';
import { runBillingWorker } from '../../src/billing/worker';
import { signToken } from '../../src/utils/jwt';
import { ensureDefaultUserGroup } from '../../src/services/permissions.service';

const suite =
  process.env.RUN_BILLING_INTEGRATION === '1' ? describe : describe.skip;
suite('Billing HTTP + PostgreSQL integration (simulated Asaas)', () => {
  let server: Server;
  let base: string;
  let payments: GatewayPayment[];
  let checkoutId: string;
  const email = 'billing-test@example.test';
  const today = new Date().toISOString().slice(0, 10);
  const input = () => ({
    requestId: randomUUID(),
    planId: 'basico' as const,
    nome: 'Cliente Teste',
    email,
    empresaNome: 'Empresa Teste',
  });
  const payment = (
    overrides: Partial<GatewayPayment> = {},
  ): GatewayPayment => ({
    id: 'pay_test',
    subscription: 'sub_test',
    customer: 'cus_test',
    checkoutSession: 'checkout_test',
    value: 39.9,
    status: 'CONFIRMED',
    billingType: 'CREDIT_CARD',
    dueDate: today,
    paymentDate: today,
    ...overrides,
  });
  async function request(path: string, body?: unknown, token?: string) {
    const response = await fetch(base + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: (await response.json()) as any };
  }
  async function checkout() {
    const result = await createCheckout(input());
    checkoutId = result.id;
    return result;
  }
  async function paid() {
    await checkout();
    payments = [payment()];
    await reconcileCheckout(checkoutId);
    return prisma.user.findUniqueOrThrow({ where: { email } });
  }
  async function activationToken() {
    const mail = await prisma.billingOutbox.findFirstOrThrow({
      where: { kind: 'activation' },
      orderBy: { createdAt: 'desc' },
    });
    const data = decrypt<{ activationUrl: string }>(mail.encryptedData);
    return new URLSearchParams(new URL(data.activationUrl).hash.slice(1)).get(
      'token',
    )!;
  }
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL || '');
    if (url.hostname !== '127.0.0.1' || url.pathname !== '/zentra_billing_test')
      throw new Error('Refusing non-test database');
    Object.assign(process.env, {
      BILLING_ENABLED: 'true',
      ASAAS_ENV: 'sandbox',
      ASAAS_API_KEY: '$aact_hmlg_test_fixture',
      ASAAS_WEBHOOK_TOKEN: randomBytes(32).toString('hex'),
      BILLING_STATUS_SECRET: randomBytes(32).toString('hex'),
      BILLING_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
      BILLING_APP_URL: 'https://app.zentra.test',
      JWT_SECRET: randomBytes(32).toString('hex'),
      BILLING_TEST_EMAIL: email,
      BILLING_GRACE_DAYS: '3',
    });
    await seedBillingPlans();
    server = app.listen(0, '127.0.0.1');
    await new Promise<void>((r) => server.once('listening', r));
    const address = server.address();
    base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/api`;
  });
  beforeEach(async () => {
    jest.restoreAllMocks();
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "User", "GrupoPermissao", "CheckoutAttempt", "BillingWebhook", "BillingOutbox", "BillingAudit" CASCADE',
    );
    await prisma.billingPlan.update({
      where: { id: 'basico' },
      data: {
        limits: {
          usuarios: { value: 1, status: 'disponivel' },
          clientes: { value: 100, status: 'disponivel' },
          produtos: { value: 30, status: 'disponivel' },
          pedidosPorMes: { value: 50, status: 'disponivel' },
        },
      },
    });
    payments = [];
    delete process.env.BREVO_API_KEY;
    delete process.env.BREVO_SENDER_EMAIL;
    jest.spyOn(asaas, 'createCheckout').mockResolvedValue({
      id: 'checkout_test',
      link: 'https://sandbox.asaas.com/000/checkoutSession/show/checkout_test',
    });
    jest.spyOn(asaas, 'cancelCheckout').mockResolvedValue(undefined);
    jest.spyOn(asaas, 'payments').mockImplementation(async () => payments);
    jest
      .spyOn(asaas, 'payment')
      .mockImplementation(async (id) => payments.find((p) => p.id === id)!);
    jest.spyOn(asaas, 'subscription').mockResolvedValue({
      id: 'sub_test',
      customer: 'cus_test',
      checkoutSession: 'checkout_test',
      value: 39.9,
      cycle: 'MONTHLY',
      billingType: 'CREDIT_CARD',
      status: 'ACTIVE',
      nextDueDate: today,
    });
    jest.spyOn(asaas, 'customer').mockResolvedValue({ id: 'cus_test', email });
    jest.spyOn(asaas, 'cancelSubscription').mockResolvedValue(undefined);
  });
  afterAll(async () => {
    jest.restoreAllMocks();
    await new Promise<void>((r) => server?.close(() => r()));
    await prisma.$disconnect();
  });
  test('approved purchase, single-use activation, first login and protected access', async () => {
    const user = await paid();
    expect(user.ativo).toBe(false);
    const token = await activationToken();
    const body = { token, senha: 'Senha de teste forte 123!' };
    const activated = await request('/billing/activate', body);
    expect(activated.status).toBe(200);
    // Activation signs the customer in and lands them on the dashboard.
    expect((await request('/auth/me', undefined, activated.body.token)).status).toBe(200);
    expect((await request('/billing/activate', body)).status).toBe(422);
    const login = await request('/auth/login', { email, senha: body.senha });
    expect(login.status).toBe(200);
    expect(
      (
        await request(
          '/billing/subscription',
          undefined,
          login.body.token || login.body.data.token,
        )
      ).status,
    ).toBe(200);
    expect(await prisma.subscription.count()).toBe(1);
    expect(await prisma.empresa.count()).toBe(1);
    expect(await prisma.kanbanColuna.count()).toBe(3);
  });
  test('declined/unpaid payment never provisions access', async () => {
    await checkout();
    payments = [payment({ status: 'PENDING', paymentDate: null })];
    await reconcileCheckout(checkoutId);
    expect(await prisma.user.count()).toBe(0);
  });
  test('abandoned checkout expires without provisioning', async () => {
    await checkout();
    await prisma.checkoutAttempt.update({
      where: { id: checkoutId },
      data: { expiresAt: new Date(0) },
    });
    await reconcileCheckout(checkoutId);
    expect(
      (
        await prisma.checkoutAttempt.findUniqueOrThrow({
          where: { id: checkoutId },
        })
      ).status,
    ).toBe('expired');
    expect(await prisma.user.count()).toBe(0);
  });
  test('duplicate and concurrent webhook delivery provisions exactly once', async () => {
    await checkout();
    payments = [payment()];
    const event = {
      id: 'evt_duplicate',
      event: 'CHECKOUT_PAID',
      checkout: { id: 'checkout_test' },
      creditCard: { number: 'must-not-persist' },
    };
    await Promise.all([
      receiveWebhook(process.env.ASAAS_WEBHOOK_TOKEN, event),
      receiveWebhook(process.env.ASAAS_WEBHOOK_TOKEN, event),
    ]);
    await Promise.all([processWebhooks(), processWebhooks()]);
    await reconcileCheckout(checkoutId);
    expect(await prisma.billingWebhook.count()).toBe(1);
    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.subscription.count()).toBe(1);
    expect(
      await prisma.billingOutbox.count({ where: { kind: 'activation' } }),
    ).toBe(1);
  });
  test('late overdue event uses current confirmed payment', async () => {
    await paid();
    await receiveWebhook(process.env.ASAAS_WEBHOOK_TOKEN, {
      id: 'late_event',
      event: 'PAYMENT_OVERDUE',
      payment: { id: 'pay_test' },
    });
    await processWebhooks();
    expect((await prisma.subscription.findFirstOrThrow()).status).toBe(
      'active',
    );
  });
  for (const table of ['User', 'Subscription'])
    test(`failure creating ${table} rolls back all provisioning and retries`, async () => {
      await checkout();
      payments = [payment()];
      await prisma.$executeRawUnsafe(
        `CREATE FUNCTION billing_test_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'simulated failure'; END $$`,
      );
      await prisma.$executeRawUnsafe(
        `CREATE TRIGGER billing_test_fail BEFORE INSERT ON "${table}" FOR EACH ROW EXECUTE FUNCTION billing_test_fail()`,
      );
      try {
        await expect(reconcileCheckout(checkoutId)).rejects.toThrow();
        expect(await prisma.user.count()).toBe(0);
        expect(await prisma.subscription.count()).toBe(0);
        expect(await prisma.billingOutbox.count()).toBe(0);
      } finally {
        await prisma.$executeRawUnsafe(
          `DROP TRIGGER billing_test_fail ON "${table}"`,
        );
        await prisma.$executeRawUnsafe('DROP FUNCTION billing_test_fail()');
      }
      await reconcileCheckout(checkoutId);
      expect(await prisma.user.count()).toBe(1);
    });
  test('email failure persists encrypted outbox and retries with backoff', async () => {
    await paid();
    process.env.BREVO_API_KEY = 'test-only';
    process.env.BREVO_SENDER_EMAIL = 'test@example.test';
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('simulated outage'));
    await deliverOutbox();
    fetchMock.mockRestore();
    const mail = await prisma.billingOutbox.findFirstOrThrow({
      where: { kind: 'activation' },
    });
    expect(mail.status).toBe('pending');
    expect(mail.attempts).toBe(1);
    expect(mail.encryptedData).not.toContain('http');
    expect(mail.availableAt.getTime()).toBeGreaterThan(Date.now());
  });
  test('expired activation fails; resend invalidates old token without enumeration', async () => {
    await paid();
    const old = await activationToken();
    await prisma.activationInvite.updateMany({
      data: { expiresAt: new Date(0), createdAt: new Date(0) },
    });
    expect(
      (
        await request('/billing/activate', {
          token: old,
          senha: 'Senha de teste forte 123!',
        })
      ).status,
    ).toBe(422);
    const resend = await request('/billing/resend-activation', { email });
    expect(resend.status).toBe(200);
    expect(
      (
        await request('/billing/resend-activation', {
          email: 'unknown@example.test',
        })
      ).body,
    ).toEqual(resend.body);
    expect(await prisma.activationInvite.count()).toBe(2);
    expect(
      (
        await request('/billing/activate', {
          token: old,
          senha: 'Senha de teste forte 123!',
        })
      ).status,
    ).toBe(422);
  });
  test('existing account requires authentication and retains its password', async () => {
    const password = await bcrypt.hash('Existing password!', 10);
    const user = await prisma.user.create({
      data: { email, nome: 'Existente', senha: password },
    });
    await expect(createCheckout(input())).rejects.toMatchObject({
      code: 'SIGN_IN_REQUIRED',
    });
    checkoutId = (await createCheckout(input(), { userId: user.id, email })).id;
    payments = [payment()];
    await reconcileCheckout(checkoutId);
    expect(await prisma.user.count()).toBe(1);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).senha,
    ).toBe(password);
    expect(await prisma.activationInvite.count()).toBe(0);
  });
  test('confirmed renewal extends the paid period', async () => {
    await paid();
    const before = await prisma.subscription.findFirstOrThrow();
    const next = before.paidUntil!.toISOString().slice(0, 10);
    payments.push(payment({ id: 'pay_renewal', dueDate: next }));
    await reconcileCheckout(checkoutId);
    const after = await prisma.subscription.findFirstOrThrow();
    expect(after.paidUntil!.getTime()).toBeGreaterThan(
      before.paidUntil!.getTime(),
    );
    expect(await prisma.billingPayment.count()).toBe(2);
  });
  test('overdue beyond grace suspends access', async () => {
    await checkout();
    payments = [
      payment({ dueDate: '2020-01-01' }),
      payment({ id: 'pay_overdue', dueDate: '2020-02-01', status: 'OVERDUE' }),
    ];
    await reconcileCheckout(checkoutId);
    const sub = await prisma.subscription.findFirstOrThrow();
    expect(sub.status).toBe('suspended');
    expect(hasAccess(sub, 3)).toBe(false);
  });
  test('cancel is owner-scoped and old paid events cannot reactivate it', async () => {
    const user = await paid();
    await prisma.user.update({ where: { id: user.id }, data: { ativo: true } });
    const auth = signToken({ userId: user.id, email });
    expect(
      (await request('/billing/subscription/cancel', {}, auth)).status,
    ).toBe(200);
    await reconcileCheckout(checkoutId);
    const sub = await prisma.subscription.findFirstOrThrow();
    expect(sub.status).toBe('canceled');
    // Renewal stops; the month already paid remains usable.
    expect(hasAccess(sub, 3)).toBe(true);
    expect((await request('/clientes', undefined, auth)).status).toBe(200);
    expect(
      (await request('/billing/subscription/cancel', {}, auth)).status,
    ).toBe(200);
    expect(asaas.cancelSubscription).toHaveBeenCalledTimes(1);
  });
  test('refund and chargeback suspend access regardless of event ordering', async () => {
    await paid();
    payments = [payment({ status: 'REFUNDED' })];
    await reconcileCheckout(checkoutId);
    expect((await prisma.subscription.findFirstOrThrow()).status).toBe(
      'suspended',
    );
    payments = [payment({ status: 'CHARGEBACK_REQUESTED' })];
    await reconcileCheckout(checkoutId);
    expect((await prisma.subscription.findFirstOrThrow()).paidUntil).toBeNull();
  });
  test('quotas are serialized and global administration stays forbidden', async () => {
    const user = await paid();
    await prisma.user.update({ where: { id: user.id }, data: { ativo: true } });
    await prisma.billingPlan.update({
      where: { id: 'basico' },
      data: { limits: { clientes: { value: 1, status: 'disponivel' } } },
    });
    const results = await Promise.allSettled(
      [1, 2].map((n) =>
        withQuota(user.id, 'clientes', (tx) =>
          tx.cliente.create({
            data: { userId: user.id, nome: 'Cliente ' + n },
          }),
        ),
      ),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.cliente.count()).toBe(1);
    expect(
      (
        await request(
          '/users',
          undefined,
          signToken({ userId: user.id, email }),
        )
      ).status,
    ).toBe(403);
  });
  test('another tenant cannot inspect or cancel this subscription', async () => {
    await paid();
    const other = await prisma.user.create({
      data: { email: 'other@example.test', nome: 'Outro', senha: 'unused' },
    });
    const auth = signToken({ userId: other.id, email: other.email });
    expect(
      (await request('/billing/subscription', undefined, auth)).body.data,
    ).toBeNull();
    expect(
      (await request('/billing/subscription/cancel', {}, auth)).status,
    ).toBe(404);
    expect(asaas.cancelSubscription).not.toHaveBeenCalled();
  });
  test('gateway outage retains event for retry without granting access', async () => {
    await checkout();
    jest
      .mocked(asaas.payments)
      .mockRejectedValueOnce(new Error('network outage'));
    await receiveWebhook(process.env.ASAAS_WEBHOOK_TOKEN, {
      id: 'outage',
      event: 'CHECKOUT_PAID',
      checkout: { id: 'checkout_test' },
    });
    await processWebhooks();
    expect(
      (
        await prisma.billingWebhook.findUniqueOrThrow({
          where: { id: 'outage' },
        })
      ).status,
    ).toBe('pending');
    expect(await prisma.user.count()).toBe(0);
  });
  test('invalid webhook and forged success cannot grant access', async () => {
    const checkout = await createCheckout(input());
    await expect(
      receiveWebhook('wrong', {
        id: 'x',
        event: 'CHECKOUT_PAID',
        checkout: { id: 'checkout_test' },
      }),
    ).rejects.toMatchObject({ statusCode: 401 });
    const state = await request('/billing/checkout-status', {
      id: checkout.id,
      token: checkout.statusToken,
    });
    expect(state.body.data.status).toBe('pending');
    expect(await prisma.user.count()).toBe(0);
    expect(
      (
        await request('/billing/checkout-status', {
          id: checkout.id,
          token: '0'.repeat(64),
        })
      ).status,
    ).toBe(404);
  });
  test('client cannot set prices; reused checkout key cannot duplicate remote operation', async () => {
    const data = input();
    expect(
      (await request('/billing/checkouts', { ...data, priceCents: 1 })).status,
    ).toBe(422);
    const first = await createCheckout(data);
    const second = await createCheckout(data);
    expect(second).toEqual(first);
    expect(asaas.createCheckout).toHaveBeenCalledTimes(1);
    expect(jest.mocked(asaas.createCheckout).mock.calls[0][0]).toMatchObject({
      items: [{ value: 39.9 }],
    });
  });
  test('mismatched value is quarantined', async () => {
    await checkout();
    payments = [payment({ value: 1 })];
    await expect(reconcileCheckout(checkoutId)).rejects.toMatchObject({
      code: 'BILLING_MISMATCH',
    });
    expect(await prisma.user.count()).toBe(0);
  });
  test('subscription from another checkout session is quarantined', async () => {
    await checkout();
    payments = [payment()];
    jest.mocked(asaas.subscription).mockResolvedValue({
      id: 'sub_test',
      customer: 'cus_test',
      checkoutSession: 'someone_elses_checkout',
      value: 39.9,
      cycle: 'MONTHLY',
      billingType: 'CREDIT_CARD',
      status: 'ACTIVE',
      nextDueDate: today,
    });
    await expect(reconcileCheckout(checkoutId)).rejects.toMatchObject({
      code: 'BILLING_MISMATCH',
    });
    expect(await prisma.user.count()).toBe(0);
  });
  test('payer email typed differently on Asaas is audited, account uses Zentra email', async () => {
    await checkout();
    payments = [payment()];
    jest
      .mocked(asaas.customer)
      .mockResolvedValue({ id: 'cus_test', email: 'Outro@Example.test' });
    await reconcileCheckout(checkoutId);
    expect(await prisma.user.findUnique({ where: { email } })).not.toBeNull();
    expect(
      await prisma.billingAudit.count({
        where: { action: 'checkout.payer_email_differs' },
      }),
    ).toBe(1);
  });
  test('uncertain create never retries a remote POST automatically', async () => {
    const data = input();
    jest
      .mocked(asaas.createCheckout)
      .mockRejectedValueOnce(new Error('timeout'));
    await expect(createCheckout(data)).rejects.toMatchObject({
      code: 'CHECKOUT_UNCERTAIN',
    });
    await expect(createCheckout(data)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(asaas.createCheckout).toHaveBeenCalledTimes(1);
    // The lost link never reached anyone, so a fresh attempt may replace it.
    const retry = await createCheckout(input());
    expect(retry.url).toContain('sandbox.asaas.com');
    expect(asaas.createCheckout).toHaveBeenCalledTimes(2);
    expect(asaas.cancelCheckout).not.toHaveBeenCalled();
  });
  test('failed cancellation is retried until remote deletion is confirmed', async () => {
    const user = await paid();
    const auth = signToken({ userId: user.id, email });
    jest
      .mocked(asaas.cancelSubscription)
      .mockRejectedValueOnce(new Error('network outage'));
    expect(
      (await request('/billing/subscription/cancel', {}, auth)).status,
    ).toBe(500);
    let sub = await prisma.subscription.findFirstOrThrow();
    expect(sub.cancelRequestedAt).not.toBeNull();
    expect(sub.canceledAt).toBeNull();
    await reconcileCheckout(checkoutId);
    sub = await prisma.subscription.findFirstOrThrow();
    expect(sub.canceledAt).toBeNull();
    jest
      .mocked(asaas.subscription)
      .mockResolvedValue({
        id: 'sub_test',
        customer: 'cus_test',
        value: 39.9,
        cycle: 'MONTHLY',
        billingType: 'CREDIT_CARD',
        status: 'INACTIVE',
        deleted: true,
        nextDueDate: today,
      });
    await runBillingWorker();
    expect((await prisma.subscription.findFirstOrThrow()).status).toBe(
      'canceled',
    );
    expect(asaas.cancelSubscription).toHaveBeenCalledTimes(2);
  });
  test('expired activation email is discarded before contacting Brevo', async () => {
    await paid();
    await prisma.activationInvite.updateMany({
      data: { expiresAt: new Date(0) },
    });
    await prisma.billingOutbox.updateMany({
      where: { kind: 'payment' },
      data: { status: 'sent' },
    });
    process.env.BREVO_API_KEY = 'test-only';
    process.env.BREVO_SENDER_EMAIL = 'test@example.test';
    const fetchMock = jest.spyOn(globalThis, 'fetch');
    await deliverOutbox();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      (
        await prisma.billingOutbox.findFirstOrThrow({
          where: { kind: 'activation' },
        })
      ).status,
    ).toBe('canceled');
  });
  test('a mismatched renewal suspends an existing subscription for review', async () => {
    await paid();
    payments = [payment({ value: 1 })];
    await expect(reconcileCheckout(checkoutId)).rejects.toMatchObject({
      code: 'BILLING_MISMATCH',
    });
    expect((await prisma.subscription.findFirstOrThrow()).status).toBe(
      'suspended',
    );
    expect(
      (
        await prisma.checkoutAttempt.findUniqueOrThrow({
          where: { id: checkoutId },
        })
      ).lastError,
    ).toBe('BILLING_MISMATCH');
  });
  test('authenticated checkout cancellation closes an unpaid attempt', async () => {
    await checkout();
    await receiveWebhook(process.env.ASAAS_WEBHOOK_TOKEN, {
      id: 'evt_cancel',
      event: 'CHECKOUT_CANCELED',
      checkout: { id: 'checkout_test' },
    });
    await processWebhooks();
    expect(
      (
        await prisma.checkoutAttempt.findUniqueOrThrow({
          where: { id: checkoutId },
        })
      ).status,
    ).toBe('canceled');
    expect(await prisma.user.count()).toBe(0);
  });
  async function activeUser() {
    const user = await paid();
    await prisma.user.update({ where: { id: user.id }, data: { ativo: true } });
    return { user, auth: signToken({ userId: user.id, email }) };
  }
  test('abandoned checkout on another device is cancelled at Asaas and replaced', async () => {
    const first = await checkout();
    jest.mocked(asaas.createCheckout).mockResolvedValueOnce({
      id: 'checkout_test_2',
      link: 'https://sandbox.asaas.com/000/checkoutSession/show/checkout_test_2',
    });
    const second = await createCheckout({ ...input(), planId: 'pro' });
    expect(second.id).not.toBe(first.id);
    expect(asaas.cancelCheckout).toHaveBeenCalledWith('checkout_test');
    const old = await prisma.checkoutAttempt.findUniqueOrThrow({
      where: { id: first.id },
    });
    expect(old.status).toBe('canceled');
    expect(
      await prisma.checkoutAttempt.count({ where: { status: 'pending' } }),
    ).toBe(1);
  });
  test('replacement is refused when the previous checkout was already paid', async () => {
    await checkout();
    payments = [payment()];
    jest
      .mocked(asaas.cancelCheckout)
      .mockRejectedValueOnce(new GatewayError(400));
    await expect(createCheckout(input())).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(
      await prisma.checkoutAttempt.count({ where: { status: 'pending' } }),
    ).toBe(1);
    await reconcileCheckout(checkoutId);
    expect(await prisma.subscription.count()).toBe(1);
  });
  test('subscription event arriving before CHECKOUT_PAID is resolved via its checkout session', async () => {
    await checkout();
    payments = [payment()];
    await receiveWebhook(process.env.ASAAS_WEBHOOK_TOKEN, {
      id: 'evt_sub_first',
      event: 'SUBSCRIPTION_CREATED',
      subscription: { id: 'sub_test' },
    });
    await processWebhooks();
    expect(
      (
        await prisma.billingWebhook.findUniqueOrThrow({
          where: { id: 'evt_sub_first' },
        })
      ).status,
    ).toBe('processed');
    expect(await prisma.subscription.count()).toBe(1);
  });
  test('webhook endpoint authenticates and never pauses the Asaas queue on odd payloads', async () => {
    const post = (token: string, body: unknown) =>
      fetch(base + '/billing/webhooks/asaas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'asaas-access-token': token,
        },
        body: JSON.stringify(body),
      });
    expect((await post('wrong', { id: 'x', event: 'CHECKOUT_PAID' })).status).toBe(401);
    expect((await post(process.env.ASAAS_WEBHOOK_TOKEN!, { unexpected: true })).status).toBe(200);
    expect((await post(process.env.ASAAS_WEBHOOK_TOKEN!, { id: 'evt_http', event: 'PAYMENT_CONFIRMED', payment: { id: 'pay_test' } })).status).toBe(200);
    expect(await prisma.billingWebhook.count()).toBe(1);
    expect(
      await prisma.billingAudit.count({ where: { action: 'webhook.unrecognized' } }),
    ).toBe(1);
  });
  test('a new customer receives one email; an existing customer gets the payment receipt', async () => {
    await paid();
    const mails = await prisma.billingOutbox.findMany();
    expect(mails.filter((m) => m.status === 'pending').map((m) => m.kind)).toEqual(['activation']);
    expect(mails.find((m) => m.kind === 'payment')?.status).toBe('skipped');
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "User", "GrupoPermissao", "CheckoutAttempt", "BillingWebhook", "BillingOutbox", "BillingAudit" CASCADE',
    );
    const user = await prisma.user.create({
      data: { email, nome: 'Existente', senha: 'unused' },
    });
    checkoutId = (await createCheckout(input(), { userId: user.id, email })).id;
    await reconcileCheckout(checkoutId);
    const receipts = await prisma.billingOutbox.findMany({ where: { status: 'pending' } });
    expect(receipts.map((m) => m.kind)).toEqual(['payment']);
  });
  test('confirmed renewal sends a renewal email', async () => {
    await paid();
    const next = (await prisma.subscription.findFirstOrThrow()).paidUntil!
      .toISOString()
      .slice(0, 10);
    payments.push(payment({ id: 'pay_renewal', dueDate: next }));
    await reconcileCheckout(checkoutId);
    expect(
      (await prisma.billingOutbox.findUniqueOrThrow({
        where: { dedupeKey: 'payment:pay_renewal' },
      })).kind,
    ).toBe('renewal');
  });
  test('Brevo delivery sends the rendered message once and drops stored content', async () => {
    await paid();
    process.env.BREVO_API_KEY = 'test-only';
    process.env.BREVO_SENDER_EMAIL = 'no-reply@zentra.test';
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ messageId: '<msg@test>' }), { status: 201 }),
      );
    await deliverOutbox();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(String(fetchMock.mock.calls[0][1]!.body));
    expect(sent.to).toEqual([{ email }]);
    expect(sent.subject).toContain('ative sua conta');
    expect(sent.htmlContent).toContain('Cliente Teste');
    expect(sent.htmlContent).toContain('https://app.zentra.test/ativar#token=');
    const mail = await prisma.billingOutbox.findFirstOrThrow({
      where: { kind: 'activation' },
    });
    expect(mail).toMatchObject({ status: 'sent', encryptedData: '', messageId: '<msg@test>' });
    await deliverOutbox();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  test('Sandbox never emails anyone but the configured test recipient', async () => {
    await paid();
    process.env.BILLING_TEST_EMAIL = 'someone-else@example.test';
    process.env.BREVO_API_KEY = 'test-only';
    process.env.BREVO_SENDER_EMAIL = 'no-reply@zentra.test';
    const fetchMock = jest.spyOn(globalThis, 'fetch');
    await deliverOutbox();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      await prisma.billingOutbox.findFirstOrThrow({ where: { kind: 'activation' } }),
    ).toMatchObject({ status: 'canceled', lastError: 'SANDBOX_RECIPIENT_BLOCKED' });
    process.env.BILLING_TEST_EMAIL = email;
  });
  test('plan limits block a lower plan and lift on a higher plan', async () => {
    const { auth } = await activeUser();
    await prisma.billingPlan.update({
      where: { id: 'basico' },
      data: { limits: { clientes: { value: 1, status: 'disponivel' } } },
    });
    expect((await request('/clientes', { nome: 'Cliente 1' }, auth)).status).toBe(201);
    const blocked = await request('/clientes', { nome: 'Cliente 2' }, auth);
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('PLAN_LIMIT');
    // A user cannot self-upgrade by starting another checkout while subscribed.
    await expect(
      createCheckout({ ...input(), planId: 'business' }, { userId: (await prisma.user.findFirstOrThrow()).id, email }),
    ).rejects.toMatchObject({ statusCode: 409 });
    await prisma.subscription.updateMany({ data: { planId: 'business' } });
    expect((await request('/clientes', { nome: 'Cliente 2' }, auth)).status).toBe(201);
  });
  test('subscription panel shows plan usage, period and open invoice links', async () => {
    const { auth } = await activeUser();
    payments.push(
      payment({
        id: 'pay_open',
        dueDate: '2099-01-01',
        status: 'PENDING',
        paymentDate: null,
        invoiceUrl: 'https://sandbox.asaas.com/i/pay_open',
      }),
    );
    await reconcileCheckout(checkoutId);
    await request('/clientes', { nome: 'Cliente 1' }, auth);
    const { status, body } = await request('/billing/subscription', undefined, auth);
    expect(status).toBe(200);
    expect(body.data).toMatchObject({
      status: 'active',
      hasAccess: true,
      plan: { id: 'basico', priceCents: 3990 },
      usage: { clientes: 1, produtos: 0, pedidosPorMes: 0 },
    });
    expect(body.data.payments.find((p: { id: string }) => p.id === 'pay_open').invoiceUrl).toBe(
      'https://sandbox.asaas.com/i/pay_open',
    );
    expect(body.data.payments.find((p: { id: string }) => p.id === 'pay_test').invoiceUrl).toBeNull();
  });
  test('without an active subscription the API answers 402 but the billing panel stays reachable', async () => {
    const { auth } = await activeUser();
    payments = [payment({ status: 'REFUNDED' })];
    await reconcileCheckout(checkoutId);
    const blocked = await request('/clientes', undefined, auth);
    expect(blocked.status).toBe(402);
    expect(blocked.body.error.code).toBe('SUBSCRIPTION_REQUIRED');
    expect((await request('/billing/subscription', undefined, auth)).status).toBe(200);
  });
  test('finished attempts stop periodic polling of Asaas', async () => {
    await checkout();
    await prisma.checkoutAttempt.update({
      where: { id: checkoutId },
      data: { expiresAt: new Date(Date.now() - 3600000) },
    });
    await reconcileCheckout(checkoutId);
    expect(
      await prisma.checkoutAttempt.findUniqueOrThrow({ where: { id: checkoutId } }),
    ).toMatchObject({ status: 'expired', nextReconcileAt: null });
  });
  test('events for sales outside Zentra on a shared Asaas account are ignored, not retried', async () => {
    payments = [payment({ id: 'pay_other', subscription: 'sub_other', checkoutSession: null })];
    jest.mocked(asaas.subscription).mockRejectedValueOnce(new GatewayError(404));
    await receiveWebhook(process.env.ASAAS_WEBHOOK_TOKEN, {
      id: 'evt_other',
      event: 'PAYMENT_CONFIRMED',
      payment: { id: 'pay_other' },
    });
    await processWebhooks();
    expect(
      await prisma.billingWebhook.findUniqueOrThrow({ where: { id: 'evt_other' } }),
    ).toMatchObject({ status: 'ignored', attempts: 1 });
    expect(await prisma.user.count()).toBe(0);
  });
  test('a stale session in the browser does not block a new visitor purchase', async () => {
    const response = await request('/billing/checkouts', input(), 'expired.or.forged.token');
    expect(response.status).toBe(201);
    expect(response.body.data.url).toContain('sandbox.asaas.com');
  });
  test('a regular account cannot list or take over other accounts (RBAC under /api)', async () => {
    const grupo = await ensureDefaultUserGroup();
    const victim = await prisma.user.create({
      data: { email: 'victim@example.test', nome: 'Vítima', senha: 'unused' },
    });
    const regular = await prisma.user.create({
      data: { email: 'regular@example.test', nome: 'Comum', senha: 'unused', grupoPermissaoId: grupo.id },
    });
    const auth = signToken({ userId: regular.id, email: regular.email });
    expect((await request('/users', undefined, auth)).status).toBe(403);
    const takeover = await fetch(base + '/users/' + victim.id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + auth },
      body: JSON.stringify({ senha: 'nova senha qualquer' }),
    });
    expect(takeover.status).toBe(403);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: victim.id } })).senha).toBe('unused');
    expect((await request('/permissoes/grupos', undefined, auth)).status).toBe(403);
    // The default group still opens every business menu.
    expect((await request('/clientes', undefined, auth)).status).toBe(200);
  });
});
