-- CreateTable
CREATE TABLE "BankBalance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL,
    "asOfDate" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankBalance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BankBalance_userId_source_key" ON "BankBalance"("userId", "source");

-- AddForeignKey
ALTER TABLE "BankBalance" ADD CONSTRAINT "BankBalance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
