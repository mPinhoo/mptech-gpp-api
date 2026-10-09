import { AppError } from '../utils/errors.js';

export type BillingEnvironment = 'sandbox' | 'production';

const ENVIRONMENTS = {
  sandbox: {
    baseUrl: 'https://api-sandbox.asaas.com/v3',
    keyPrefix: '$aact_hmlg_',
    checkoutHosts: ['sandbox.asaas.com'],
  },
  production: {
    baseUrl: 'https://api.asaas.com/v3',
    keyPrefix: '$aact_prod_',
    checkoutHosts: ['asaas.com', 'www.asaas.com'],
  },
} as const;

export function billingEnabled() {
  return process.env.BILLING_ENABLED === 'true';
}
export function billingEnvironment(): BillingEnvironment {
  return process.env.ASAAS_ENV === 'production' ? 'production' : 'sandbox';
}
export function billingConfig() {
  const environment = billingEnvironment();
  const env = ENVIRONMENTS[environment];
  // Real charges require a second, explicit human switch besides the key itself.
  if (
    !billingEnabled() ||
    !process.env.ASAAS_API_KEY ||
    (environment === 'production' &&
      process.env.BILLING_LIVE_APPROVED !== 'true')
  ) {
    throw new AppError(
      'Contratação indisponível no momento. Contate a equipe Zentra.',
      503,
      'BILLING_UNAVAILABLE',
    );
  }
  const key = process.env.ASAAS_API_KEY;
  if (!key.startsWith(env.keyPrefix))
    throw new AppError(
      'A chave Asaas não corresponde ao ambiente configurado.',
      503,
      'BILLING_CONFIG',
    );
  for (const name of [
    'ASAAS_WEBHOOK_TOKEN',
    'BILLING_STATUS_SECRET',
    'BILLING_ENCRYPTION_KEY',
  ]) {
    if ((process.env[name] || '').length < 32)
      throw new AppError(
        'Configuração segura de cobrança incompleta.',
        503,
        'BILLING_CONFIG',
      );
  }
  if (!/^[a-f0-9]{64}$/i.test(process.env.BILLING_ENCRYPTION_KEY || ''))
    throw new AppError(
      'Chave de criptografia inválida.',
      503,
      'BILLING_CONFIG',
    );
  // Asaas rejects non-HTTPS callback URLs (localhost included).
  const appUrl = process.env.BILLING_APP_URL || '';
  if (!/^https:\/\/[^\s?#]+$/.test(appUrl)) {
    throw new AppError('URL de retorno inválida.', 503, 'BILLING_CONFIG');
  }
  return {
    key,
    environment,
    baseUrl: env.baseUrl,
    checkoutHosts: env.checkoutHosts as readonly string[],
    appUrl: appUrl.replace(/\/$/, ''),
  };
}
export function graceDays() {
  const n = Number(process.env.BILLING_GRACE_DAYS || 3);
  return Number.isInteger(n) && n >= 0 && n <= 30 ? n : 3;
}
