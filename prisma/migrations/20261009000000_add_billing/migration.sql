-- AlterTable
ALTER TABLE "User" ADD COLUMN     "billingManaged" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Empresa" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "cycle" TEXT NOT NULL DEFAULT 'MONTHLY',
    "available" BOOLEAN NOT NULL DEFAULT true,
    "limits" JSONB NOT NULL,
    "features" JSONB NOT NULL,

    CONSTRAINT "BillingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckoutAttempt" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "empresaNome" TEXT NOT NULL,
    "existingUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'creating',
    "gatewayId" TEXT,
    "gatewaySubscriptionId" TEXT,
    "gatewayCustomerId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "nextReconcileAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckoutAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "checkoutId" TEXT NOT NULL,
    "gatewayId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidUntil" TIMESTAMP(3),
    "nextDueDate" TIMESTAMP(3),
    "cancelRequestedAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingPayment" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "valueCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingWebhook" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "BillingWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivationInvite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivationInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingOutbox" (
    "id" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "encryptedData" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "messageId" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingAudit" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Empresa_ownerId_key" ON "Empresa"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutAttempt_requestId_key" ON "CheckoutAttempt"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutAttempt_gatewayId_key" ON "CheckoutAttempt"("gatewayId");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutAttempt_gatewaySubscriptionId_key" ON "CheckoutAttempt"("gatewaySubscriptionId");

-- CreateIndex
CREATE INDEX "CheckoutAttempt_email_createdAt_idx" ON "CheckoutAttempt"("email", "createdAt");

-- CreateIndex
CREATE INDEX "CheckoutAttempt_nextReconcileAt_idx" ON "CheckoutAttempt"("nextReconcileAt");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_checkoutId_key" ON "Subscription"("checkoutId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_gatewayId_key" ON "Subscription"("gatewayId");

-- CreateIndex
CREATE INDEX "Subscription_empresaId_status_idx" ON "Subscription"("empresaId", "status");

-- CreateIndex
CREATE INDEX "BillingPayment_subscriptionId_dueDate_idx" ON "BillingPayment"("subscriptionId", "dueDate");

-- CreateIndex
CREATE INDEX "BillingWebhook_status_availableAt_idx" ON "BillingWebhook"("status", "availableAt");

-- CreateIndex
CREATE UNIQUE INDEX "ActivationInvite_tokenHash_key" ON "ActivationInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "ActivationInvite_userId_usedAt_idx" ON "ActivationInvite"("userId", "usedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillingOutbox_dedupeKey_key" ON "BillingOutbox"("dedupeKey");

-- CreateIndex
CREATE INDEX "BillingOutbox_status_availableAt_idx" ON "BillingOutbox"("status", "availableAt");

-- CreateIndex
CREATE INDEX "BillingAudit_resourceId_createdAt_idx" ON "BillingAudit"("resourceId", "createdAt");

-- AddForeignKey
ALTER TABLE "Empresa" ADD CONSTRAINT "Empresa_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutAttempt" ADD CONSTRAINT "CheckoutAttempt_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BillingPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BillingPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_checkoutId_fkey" FOREIGN KEY ("checkoutId") REFERENCES "CheckoutAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingPayment" ADD CONSTRAINT "BillingPayment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivationInvite" ADD CONSTRAINT "ActivationInvite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Defense in depth for Supabase/PostgREST: only the trusted backend/table owner
-- accesses billing. No anonymous or authenticated client policies are granted.
ALTER TABLE "Empresa" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BillingPlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CheckoutAttempt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Subscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BillingPayment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BillingWebhook" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ActivationInvite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BillingOutbox" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BillingAudit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BillingPlan" ADD CONSTRAINT "BillingPlan_price_positive" CHECK ("priceCents" > 0);
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_status_valid" CHECK (status IN ('pending','active','past_due','suspended','canceled','expired'));
ALTER TABLE "CheckoutAttempt" ADD CONSTRAINT "CheckoutAttempt_status_valid" CHECK (status IN ('creating','pending','uncertain','paid','canceled','expired'));
CREATE UNIQUE INDEX "Subscription_one_uncanceled_per_empresa" ON "Subscription" ("empresaId") WHERE "canceledAt" IS NULL;
CREATE UNIQUE INDEX "CheckoutAttempt_one_open_per_email" ON "CheckoutAttempt" (lower(email)) WHERE status IN ('creating','pending','uncertain','paid');
CREATE INDEX "CheckoutAttempt_existingUserId_idx" ON "CheckoutAttempt"("existingUserId");
ALTER TABLE "CheckoutAttempt" ADD CONSTRAINT "CheckoutAttempt_existingUserId_fkey" FOREIGN KEY ("existingUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
