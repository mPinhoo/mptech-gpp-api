-- Asaas returns the hosted checkout link; its format differs between environments
-- and must be replayed verbatim when an idempotent checkout request is retried.
ALTER TABLE "CheckoutAttempt" ADD COLUMN "gatewayUrl" TEXT;

-- NULL means no periodic reconciliation is scheduled (terminal attempts).
-- Webhooks still trigger reconciliation for these rows.
ALTER TABLE "CheckoutAttempt" ALTER COLUMN "nextReconcileAt" DROP NOT NULL;

-- Hosted Asaas invoice, so an overdue customer can settle it from the panel.
ALTER TABLE "BillingPayment" ADD COLUMN "invoiceUrl" TEXT;
