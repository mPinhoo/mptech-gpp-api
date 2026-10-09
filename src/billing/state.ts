import { GatewayPayment } from './asaas.js';

export const PAID_STATUSES = ['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'];
const CHARGEBACK_STATUSES = [
  'CHARGEBACK_REQUESTED',
  'CHARGEBACK_DISPUTE',
  'AWAITING_CHARGEBACK_REVERSAL',
];
const REFUND_STATUSES = [
  'REFUNDED',
  'PARTIALLY_REFUNDED',
  'REFUND_REQUESTED',
  'REFUND_IN_PROGRESS',
];
export type SubscriptionEnd = 'canceled' | 'expired' | null;

export function cycleEnd(value: string): Date {
  const date = new Date(value + 'T00:00:00-03:00');
  const [year, month, day] = value.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  date.setUTCFullYear(year, month, Math.min(day, lastDay));
  return date;
}
const today = (now: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(now);

export function deriveState(
  payments: GatewayPayment[],
  ended: SubscriptionEnd,
  grace: number,
  now = new Date(),
) {
  const refunded = (p: GatewayPayment) =>
    REFUND_STATUSES.includes(p.status) ||
    !!p.refunds?.some(
      (r) =>
        r.value > 0 && !['CANCELLED', 'CANCELED', 'DENIED'].includes(r.status),
    );
  const paid = payments.filter(
    (p) => PAID_STATUSES.includes(p.status) && !refunded(p),
  );
  const paidUntil = paid.reduce<Date | null>((last, p) => {
    const end = cycleEnd(p.dueDate);
    return !last || end > last ? end : last;
  }, null);
  // Asaas issues the next charge up to 40 days early, so the period in force is
  // the latest charge already due, not the latest charge overall.
  const byDue = [...payments].sort((a, b) => b.dueDate.localeCompare(a.dueDate));
  const current = byDue.find((p) => p.dueDate <= today(now)) || byDue[0];
  const revoked =
    payments.some((p) => CHARGEBACK_STATUSES.includes(p.status)) ||
    (!!current && refunded(current));
  // A cancelled subscription keeps what was paid for, unless the money returned.
  if (ended) return { status: ended, paidUntil: revoked ? null : paidUntil };
  if (revoked) return { status: 'suspended', paidUntil: null };
  if (paidUntil && paidUntil > now) return { status: 'active', paidUntil };
  if (paidUntil && now.getTime() < paidUntil.getTime() + grace * 86400000)
    return { status: 'past_due', paidUntil };
  if (paidUntil) return { status: 'suspended', paidUntil };
  return { status: 'pending', paidUntil: null };
}
export function hasAccess(
  sub: { status: string; paidUntil: Date | null },
  grace: number,
  now = new Date(),
) {
  if (!sub.paidUntil) return false;
  // Cancellation stops renewal; access lasts until the paid period ends.
  if (['canceled', 'expired'].includes(sub.status))
    return now.getTime() < sub.paidUntil.getTime();
  if (!['active', 'past_due'].includes(sub.status)) return false;
  return now.getTime() < sub.paidUntil.getTime() + grace * 86400000;
}
