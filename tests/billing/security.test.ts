import { randomBytes } from 'node:crypto';
import { billingConfig } from '../../src/billing/config';
import { cycleEnd, deriveState, hasAccess } from '../../src/billing/state';
import { decrypt, encrypt, secureEqual } from '../../src/billing/security';
import { AsaasClient, GatewayPayment } from '../../src/billing/asaas';
import { mailContent } from '../../src/billing/outbox';
import { nextCheck } from '../../src/billing/reconcile';
const original = { ...process.env };
beforeEach(() => {
  Object.assign(process.env, {
    BILLING_ENABLED: 'true',
    ASAAS_ENV: 'sandbox',
    ASAAS_API_KEY: '$aact_hmlg_test_fixture',
    ASAAS_WEBHOOK_TOKEN: randomBytes(32).toString('hex'),
    BILLING_STATUS_SECRET: randomBytes(32).toString('hex'),
    BILLING_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
    BILLING_APP_URL: 'https://app.zentra.test',
  });
  delete process.env.BILLING_LIVE_APPROVED;
});
afterEach(() => {
  process.env = { ...original };
  jest.restoreAllMocks();
});
const payment = (overrides: Partial<GatewayPayment>): GatewayPayment => ({
  id: 'pay',
  customer: 'cus',
  subscription: 'sub',
  billingType: 'CREDIT_CARD',
  value: 39.9,
  dueDate: '2026-10-01',
  status: 'CONFIRMED',
  ...overrides,
});
test('production requires explicit approval and a matching key before any request', async () => {
  const fetchMock = jest.spyOn(globalThis, 'fetch');
  process.env.ASAAS_ENV = 'production';
  await expect(
    new AsaasClient().request('/checkouts', 'POST', {}),
  ).rejects.toMatchObject({ code: 'BILLING_UNAVAILABLE' });
  process.env.BILLING_LIVE_APPROVED = 'true';
  expect(() => billingConfig()).toThrow('não corresponde');
  process.env.ASAAS_API_KEY = '$aact_prod_test_fixture';
  expect(billingConfig()).toMatchObject({
    environment: 'production',
    baseUrl: 'https://api.asaas.com/v3',
  });
  process.env.ASAAS_ENV = 'sandbox';
  expect(() => billingConfig()).toThrow('não corresponde');
  expect(fetchMock).not.toHaveBeenCalled();
});
test('callback URL must be public HTTPS, as Asaas requires', () => {
  process.env.BILLING_APP_URL = 'http://localhost:3000';
  expect(() => billingConfig()).toThrow('URL de retorno');
  process.env.BILLING_APP_URL = 'https://app.zentra.test/';
  expect(billingConfig().appUrl).toBe('https://app.zentra.test');
});
test('authenticated headers, redirect blocking and sanitized gateway errors', async () => {
  const fetchMock = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(
      new Response(
        JSON.stringify({
          errors: [{ description: 'private provider detail' }],
        }),
        { status: 401 },
      ),
    );
  await expect(new AsaasClient().request('/customers')).rejects.toMatchObject({
    message:
      'Não foi possível confirmar a operação com o Asaas. Aguarde a conciliação.',
  });
  expect(fetchMock).toHaveBeenCalledWith(
    'https://api-sandbox.asaas.com/v3/customers',
    expect.objectContaining({
      redirect: 'error',
      headers: expect.objectContaining({
        'User-Agent': 'Zentra/1.0 (sandbox)',
        access_token: process.env.ASAAS_API_KEY,
      }),
    }),
  );
});
test('checkout link is taken from Asaas and pinned to the environment host', async () => {
  const link = 'https://sandbox.asaas.com/000/checkoutSession/show/chk_1';
  jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'chk_1', link })))
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({ id: 'chk_2', link: 'https://evil.example/pay' }),
      ),
    );
  await expect(new AsaasClient().createCheckout({})).resolves.toEqual({
    id: 'chk_1',
    link,
  });
  await expect(new AsaasClient().createCheckout({})).rejects.toMatchObject({
    code: 'GATEWAY_UNAVAILABLE',
  });
});
test('pagination retrieves every payment page and strips sensitive fields', async () => {
  const data = {
    ...payment({ id: 'pay_test', dueDate: '2026-10-09' }),
    creditCard: { creditCardToken: 'test-card-token' },
  };
  const mock = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [data], hasMore: true })),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [], hasMore: false })),
    );
  const result = await new AsaasClient().payments('subscription', 'sub_test');
  expect(result).toHaveLength(1);
  expect(result[0]).not.toHaveProperty('creditCard');
  expect(mock).toHaveBeenCalledTimes(2);
});
test('encryption authenticates stored mail and token comparison handles lengths', () => {
  const encrypted = encrypt({ text: 'private test' });
  expect(encrypted).not.toContain('private test');
  expect(decrypt(encrypted)).toEqual({ text: 'private test' });
  const parts = encrypted.split('.');
  parts[1] = Buffer.alloc(16).toString('base64');
  expect(() => decrypt(parts.join('.'))).toThrow();
  expect(secureEqual('a', 'bb')).toBe(false);
});
test('monthly boundaries clamp to leap-day and year rollover', () => {
  expect(cycleEnd('2024-01-31').toISOString()).toBe('2024-02-29T03:00:00.000Z');
  expect(cycleEnd('2025-01-31').toISOString()).toBe('2025-02-28T03:00:00.000Z');
  expect(cycleEnd('2026-12-31').toISOString()).toBe('2027-01-31T03:00:00.000Z');
});
test('grace window expires without requiring a webhook', () => {
  const sub = { status: 'active', paidUntil: new Date('2026-10-01T03:00:00Z') };
  expect(hasAccess(sub, 3, new Date('2026-10-03T03:00:00Z'))).toBe(true);
  expect(hasAccess(sub, 3, new Date('2026-10-04T03:00:00Z'))).toBe(false);
});
test('a cancelled subscription keeps access until the paid period ends, without grace', () => {
  const now = new Date('2026-10-09T12:00:00Z');
  const state = deriveState([payment({})], 'canceled', 3, now);
  expect(state).toEqual({
    status: 'canceled',
    paidUntil: new Date('2026-11-01T03:00:00Z'),
  });
  expect(hasAccess(state, 3, now)).toBe(true);
  expect(hasAccess(state, 3, new Date('2026-11-02T03:00:00Z'))).toBe(false);
  const refunded = deriveState([payment({ status: 'REFUNDED' })], 'canceled', 3, now);
  expect(hasAccess(refunded, 3, now)).toBe(false);
});
test('a partial refund on the current paid period suspends access', () => {
  const p = payment({ refunds: [{ status: 'DONE', value: 10 }] });
  expect(deriveState([p], null, 3, new Date('2026-10-09')).status).toBe(
    'suspended',
  );
});
test('a refund is detected even when next month is already issued as pending', () => {
  // Asaas issues the next charge up to 40 days before it is due.
  const state = deriveState(
    [
      payment({ status: 'REFUNDED' }),
      payment({ id: 'next', dueDate: '2026-11-01', status: 'PENDING' }),
    ],
    null,
    3,
    new Date('2026-10-09T12:00:00Z'),
  );
  expect(state).toEqual({ status: 'suspended', paidUntil: null });
});
test('cash receipts count as paid and gateway expiry ends the subscription', () => {
  const now = new Date('2026-10-09T12:00:00Z');
  expect(deriveState([payment({ status: 'RECEIVED_IN_CASH' })], null, 3, now).status).toBe('active');
  expect(deriveState([payment({})], 'expired', 3, now).status).toBe('expired');
});
test('reconciliation cadence backs off for healthy and finished subscriptions', () => {
  const now = Date.parse('2026-10-09T12:00:00Z');
  const in20Days = new Date(now + 20 * 86400000);
  expect(nextCheck('active', in20Days, now)!.getTime() - now).toBe(6 * 3600000);
  expect(nextCheck('past_due', new Date(now - 86400000), now)!.getTime() - now).toBe(15 * 60000);
  expect(nextCheck('suspended', null, now)!.getTime() - now).toBe(86400000);
  expect(nextCheck('canceled', in20Days, now)!.getTime() - now).toBe(86400000);
  expect(nextCheck('canceled', new Date(now - 8 * 86400000), now)).toBeNull();
});
test('emails are complete, escaped and point to HTTPS app routes', () => {
  const activation = mailContent('activation', {
    nome: '<b>Ana</b>',
    email: 'ana@example.test',
    planName: 'Pro',
    activationUrl: 'https://app.zentra.test/ativar#token=abc',
  });
  expect(activation.subject).toContain('ative sua conta');
  expect(activation.htmlContent).toContain('&lt;b&gt;Ana&lt;/b&gt;');
  expect(activation.htmlContent).not.toContain('<b>Ana</b>');
  expect(activation.htmlContent).toContain('ana@example.test');
  expect(activation.htmlContent).toContain('https://app.zentra.test/ativar#token=abc');
  expect(activation.textContent).toContain('48 horas');
  const canceled = mailContent('canceled', {
    nome: 'Ana',
    planName: 'Pro',
    paidUntil: '2026-11-01T03:00:00.000Z',
  });
  expect(canceled.textContent).toContain('01/11/2026');
  expect(canceled.htmlContent).toContain('https://app.zentra.test/assinatura');
  for (const kind of ['resend', 'payment', 'renewal', 'declined', 'past_due', 'suspended'] as const)
    expect(mailContent(kind, { nome: 'Ana' }).subject).toMatch(/Zentra/);
});
