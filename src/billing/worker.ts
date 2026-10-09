import prisma from '../utils/prisma.js';
import { billingEnabled } from './config.js';
import { asaas } from './asaas.js';
import { processWebhooks } from './webhooks.js';
import { reconcileCheckout } from './reconcile.js';
import { deliverOutbox } from './outbox.js';
import { AppError } from '../utils/errors.js';
import { seedBillingPlans } from './catalog.js';
let running = false;
export async function runBillingWorker() {
  if (!billingEnabled() || running) return;
  running = true;
  try {
    const cancellations = await prisma.subscription.findMany({
      where: { cancelRequestedAt: { not: null }, canceledAt: null },
      take: 20,
    });
    for (const sub of cancellations) {
      try {
        await asaas.cancelSubscription(sub.gatewayId);
        await reconcileCheckout(sub.checkoutId);
      } catch {
        /* Durable request is retried next run. */
      }
    }
    await processWebhooks();
    const checkouts = await prisma.checkoutAttempt.findMany({
      where: { nextReconcileAt: { lte: new Date() } },
      orderBy: { nextReconcileAt: 'asc' },
      take: 20,
    });
    for (const checkout of checkouts) {
      try {
        await reconcileCheckout(checkout.id);
      } catch (error) {
        // A financial mismatch was already quarantined and rescheduled.
        if (error instanceof AppError && error.code === 'BILLING_MISMATCH')
          continue;
        await prisma.checkoutAttempt.update({
          where: { id: checkout.id },
          data: {
            lastError:
              error instanceof AppError ? error.code : 'RECONCILIATION_FAILED',
            nextReconcileAt: new Date(Date.now() + 300000),
          },
        });
      }
    }
    await deliverOutbox();
  } finally {
    running = false;
  }
}
export function startBillingWorker() {
  if (billingEnabled())
    void seedBillingPlans().catch(() =>
      console.error('[Billing] Catálogo de planos não sincronizado.'),
    );
  const run = () => {
    void runBillingWorker().catch(() =>
      console.error(
        '[Billing] Worker indisponível; os registros persistidos serão reprocessados.',
      ),
    );
  };
  run();
  return setInterval(run, 30000);
}
