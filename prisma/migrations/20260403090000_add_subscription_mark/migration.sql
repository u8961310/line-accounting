-- CreateTable
CREATE TABLE "SubscriptionMark" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "patternKey" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionMark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionMark_userId_patternKey_key" ON "SubscriptionMark"("userId", "patternKey");

-- AddForeignKey
ALTER TABLE "SubscriptionMark" ADD CONSTRAINT "SubscriptionMark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
