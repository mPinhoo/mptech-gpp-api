import 'dotenv/config';
import prisma from '../src/utils/prisma.js';
async function main() {
  const [webhooks, emails, reviews] = await Promise.all([
    prisma.billingWebhook.groupBy({ by: ['status'], _count: { id: true } }),
    prisma.billingOutbox.groupBy({ by: ['status'], _count: { id: true } }),
    prisma.checkoutAttempt.count({ where: { lastError: 'BILLING_MISMATCH' } }),
  ]);
  console.log(
    JSON.stringify(
      { webhooks, emails, checkoutsRequiringReview: reviews },
      null,
      2,
    ),
  );
}
main()
  .catch(() => {
    console.error('Billing status unavailable.');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
