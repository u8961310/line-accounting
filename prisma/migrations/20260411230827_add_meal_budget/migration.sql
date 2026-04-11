-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "mealType" TEXT;

-- CreateTable
CREATE TABLE "MealBudget" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mealType" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealBudget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MealBudget_userId_idx" ON "MealBudget"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MealBudget_userId_mealType_key" ON "MealBudget"("userId", "mealType");

-- AddForeignKey
ALTER TABLE "MealBudget" ADD CONSTRAINT "MealBudget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Transaction_userId_date_mealType_idx" ON "Transaction"("userId", "date", "mealType");
