-- CreateTable
CREATE TABLE "HealthScoreSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "savingsScore" INTEGER NOT NULL,
    "debtScore" INTEGER NOT NULL,
    "budgetScore" INTEGER NOT NULL,
    "savingsRate" DOUBLE PRECISION NOT NULL,
    "debtRatio" DOUBLE PRECISION NOT NULL,
    "budgetAdherence" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthScoreSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HealthScoreSnapshot_userId_idx" ON "HealthScoreSnapshot"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "HealthScoreSnapshot_userId_month_key" ON "HealthScoreSnapshot"("userId", "month");

-- AddForeignKey
ALTER TABLE "HealthScoreSnapshot" ADD CONSTRAINT "HealthScoreSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
