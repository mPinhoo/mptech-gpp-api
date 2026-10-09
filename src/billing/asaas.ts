import { z } from 'zod';
import { AppError } from '../utils/errors.js';
import { billingConfig } from './config.js';

export class GatewayError extends AppError {
  constructor(public gatewayStatus: number) {
    super(
      'Não foi possível confirmar a operação com o Asaas. Aguarde a conciliação.',
      502,
      'GATEWAY_UNAVAILABLE',
    );
  }
}
export const paymentSchema = z.object({
  id: z.string(),
  subscription: z.string().nullable().optional(),
  customer: z.string(),
  checkoutSession: z.string().nullable().optional(),
  value: z.number(),
  status: z.string(),
  billingType: z.string(),
  refunds: z
    .array(z.object({ status: z.string(), value: z.number() }))
    .nullish(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paymentDate: z.string().nullable().optional(),
  invoiceUrl: z.string().nullish(),
  confirmedDate: z.string().nullable().optional(),
});
export type GatewayPayment = z.infer<typeof paymentSchema>;
export const subscriptionSchema = z.object({
  id: z.string(),
  customer: z.string(),
  checkoutSession: z.string().nullish(),
  value: z.number(),
  cycle: z.string(),
  billingType: z.string(),
  status: z.string(),
  deleted: z.boolean().optional(),
  nextDueDate: z.string(),
});
export type GatewaySubscription = z.infer<typeof subscriptionSchema>;
export class AsaasClient {
  async request(
    path: string,
    method = 'GET',
    body?: unknown,
  ): Promise<unknown> {
    const { key, baseUrl, environment } = billingConfig();
    let response: Response;
    try {
      response = await fetch(baseUrl + path, {
        method,
        headers: {
          access_token: key,
          'User-Agent': `Zentra/1.0 (${environment})`,
          'Content-Type': 'application/json',
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(10000),
        redirect: 'error',
      });
    } catch {
      throw new GatewayError(0);
    }
    if (!response.ok) throw new GatewayError(response.status);
    try {
      return await response.json();
    } catch {
      throw new GatewayError(0);
    }
  }
  async createCheckout(body: unknown) {
    const { checkoutHosts } = billingConfig();
    const result = z
      .object({ id: z.string().min(1).max(200), link: z.string().url() })
      .parse(await this.request('/checkouts', 'POST', body));
    // The link format is gateway-controlled (it differs between environments),
    // so only its origin is pinned before the browser is sent there.
    const link = new URL(result.link);
    if (link.protocol !== 'https:' || !checkoutHosts.includes(link.hostname))
      throw new GatewayError(0);
    return { id: result.id, link: link.href };
  }
  async cancelCheckout(id: string) {
    await this.request(`/checkouts/${encodeURIComponent(id)}/cancel`, 'POST');
  }
  async payment(id: string) {
    return paymentSchema.parse(
      await this.request(`/payments/${encodeURIComponent(id)}`),
    );
  }
  async subscription(id: string) {
    return subscriptionSchema.parse(
      await this.request(`/subscriptions/${encodeURIComponent(id)}`),
    );
  }
  async customer(id: string) {
    return z
      .object({ id: z.string(), email: z.string().nullable() })
      .parse(await this.request(`/customers/${encodeURIComponent(id)}`));
  }
  async payments(
    filter: 'subscription' | 'checkoutSession',
    id: string,
  ): Promise<GatewayPayment[]> {
    const all: GatewayPayment[] = [];
    for (let offset = 0; offset < 10000; offset += 100) {
      const page = z
        .object({ data: z.array(paymentSchema), hasMore: z.boolean() })
        .parse(
          await this.request(
            `/payments?${filter}=${encodeURIComponent(id)}&limit=100&offset=${offset}`,
          ),
        );
      all.push(...page.data);
      if (!page.hasMore) return all;
    }
    throw new GatewayError(0); // Never reconcile a truncated payment history.
  }
  async cancelSubscription(id: string) {
    try {
      await this.request(`/subscriptions/${encodeURIComponent(id)}`, 'DELETE');
    } catch (e) {
      if (!(e instanceof GatewayError && e.gatewayStatus === 404)) throw e;
    }
  }
}
export const asaas = new AsaasClient();
