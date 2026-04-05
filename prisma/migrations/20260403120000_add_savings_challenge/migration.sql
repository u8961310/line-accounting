-- CreateTable
CREATE TABLE "SavingsChallenge" (
    "id"             TEXT NOT NULL,
    "userId"         TEXT NOT NULL,
    "name"           TEXT NOT NULL DEFAULT '52 週存錢挑戰',
    "type"           TEXT NOT NULL DEFAULT '52-week-asc',
    "multiplier"     DOUBLE PRECISION NOT NULL DEFAULT 100,
    "fixedAmount"    DOUBLE PRECISION NOT NULL DEFAULT 500,
    "completedWeeks" TEXT NOT NULL DEFAULT '[]',
    "startYear"      INTEGER NOT NULL DEFAULT 2026,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavingsChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SavingsChallenge_userId_key" ON "SavingsChallenge"("userId");

-- AddForeignKey
ALTER TABLE "SavingsChallenge" ADD CONSTRAINT "SavingsChallenge_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
