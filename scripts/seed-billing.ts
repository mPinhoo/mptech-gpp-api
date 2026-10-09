import 'dotenv/config';
import { seedBillingPlans } from '../src/billing/catalog.js';
import prisma from '../src/utils/prisma.js';
const url = new URL(process.env.DATABASE_URL || '');
if (
  !['localhost', '127.0.0.1'].includes(url.hostname) ||
  !url.pathname.startsWith('/zentra_billing_')
) {
  throw new Error(
    'This helper only seeds an explicitly named local billing database.',
  );
}
seedBillingPlans()
  .then(() => console.log('Billing catalog seeded from existing Zentra plans.'))
  .finally(() => prisma.$disconnect());
