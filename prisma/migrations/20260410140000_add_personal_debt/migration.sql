CREATE TABLE "PersonalDebt" (
    "id"           TEXT NOT NULL,
    "userId"       TEXT NOT NULL,
    "counterparty" TEXT NOT NULL,
    "direction"    TEXT NOT NULL,
    "amount"       DECIMAL(12,2) NOT NULL,
    "note"         TEXT NOT NULL DEFAULT '',
    "dueDate"      TIMESTAMP(3),
    "settledAt"    TIMESTAMP(3),
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalDebt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PersonalDebt_userId_idx" ON "PersonalDebt"("userId");

ALTER TABLE "PersonalDebt" ADD CONSTRAINT "PersonalDebt_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
