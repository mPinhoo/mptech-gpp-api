import 'dotenv/config';
import { z } from 'zod';
import { asaas } from '../src/billing/asaas.js';
import { billingConfig } from '../src/billing/config.js';
import { AppError } from '../src/utils/errors.js';
import { WEBHOOK_EVENTS } from '../src/billing/webhooks.js';

async function main() {
  // This process only reads configuration or registers a webhook. It never
  // creates a checkout/payment and does not change the server feature flag.
  process.env.BILLING_ENABLED = 'true';
  const { environment } = billingConfig();
  const response = z
    .object({
      data: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          url: z.string(),
          enabled: z.boolean(),
          interrupted: z.boolean(),
          events: z.array(z.string()),
        }),
      ),
      hasMore: z.boolean(),
    })
    .parse(await asaas.request('/webhooks?limit=100'));
  if (response.hasMore) throw new Error('Webhook inventory incomplete.');
  if (!process.argv.includes('--create')) {
    console.log(
      JSON.stringify({
        environment,
        authentication: 'ok',
        webhookCount: response.data.length,
      }),
    );
    return;
  }
  const url = new URL(process.env.ASAAS_WEBHOOK_URL || '');
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/api/billing/webhooks/asaas' ||
    ['localhost', '127.0.0.1', '::1'].includes(url.hostname)
  )
    throw new Error(
      'Configure a public HTTPS ASAAS_WEBHOOK_URL ending in /api/billing/webhooks/asaas.',
    );
  const email = z.string().email().parse(process.env.ASAAS_WEBHOOK_EMAIL);
  const name = `Zentra ${environment} subscriptions`;
  const existing = response.data.find(
    (h) => h.name === name || h.url === url.href,
  );
  if (existing) {
    const valid =
      existing.url === url.href &&
      existing.enabled &&
      !existing.interrupted &&
      WEBHOOK_EVENTS.every((e) => existing.events.includes(e));
    if (!valid)
      throw new Error(
        'Existing Zentra webhook requires review; no changes were made.',
      );
    console.log(
      'Existing Sandbox webhook reused. Verify its auth token matches the local secret; it is never displayed.',
    );
    return;
  }
  await asaas.request('/webhooks', 'POST', {
    name,
    url: url.href,
    email,
    enabled: true,
    interrupted: false,
    apiVersion: 3,
    sendType: 'SEQUENTIALLY',
    authToken: process.env.ASAAS_WEBHOOK_TOKEN,
    events: WEBHOOK_EVENTS,
  });
  console.log(
    'Sandbox webhook registered. No charges created and no secrets displayed.',
  );
}
main().catch((error: unknown) => {
  // Configuration messages are safe to show; provider responses are not logged.
  if (error instanceof AppError) console.error(error.message);
  console.error(
    'Asaas setup not completed. Check the API key, HTTPS webhook URL, notification email, and existing configuration.',
  );
  process.exitCode = 1;
});
