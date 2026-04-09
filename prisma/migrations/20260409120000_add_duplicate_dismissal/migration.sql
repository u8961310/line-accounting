-- CreateTable
CREATE TABLE "DuplicateDismissal" (
    "id" TEXT NOT NULL,
    "transactionAId" TEXT NOT NULL,
    "transactionBId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DuplicateDismissal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DuplicateDismissal_transactionAId_idx" ON "DuplicateDismissal"("transactionAId");

-- CreateIndex
CREATE INDEX "DuplicateDismissal_transactionBId_idx" ON "DuplicateDismissal"("transactionBId");

-- CreateIndex
CREATE UNIQUE INDEX "DuplicateDismissal_transactionAId_transactionBId_key" ON "DuplicateDismissal"("transactionAId", "transactionBId");

-- DropTable (unused, already removed from schema)
DROP TABLE IF EXISTS "SubscriptionMark";
