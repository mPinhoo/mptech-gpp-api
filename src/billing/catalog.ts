import prisma from '../utils/prisma.js';
import plans from './plans.json';

// plans.json is the price authority for checkout. Each subscription keeps the
// price it was sold at, so later catalog changes only affect new checkouts.
export async function seedBillingPlans() {
  for (const p of plans) {
    const data = {
      name: p.name,
      description: p.audience,
      priceCents: p.priceCents,
      limits: p.limits,
      features: p.items,
    };
    await prisma.billingPlan.upsert({
      where: { id: p.id },
      update: data,
      create: { id: p.id, ...data },
    });
  }
}
