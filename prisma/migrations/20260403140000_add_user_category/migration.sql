-- CreateTable
CREATE TABLE "UserCategory" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "type"      TEXT NOT NULL DEFAULT 'both',  -- 'expense' | 'income' | 'both'
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserCategory_userId_name_key" ON "UserCategory"("userId", "name");

-- AddForeignKey
ALTER TABLE "UserCategory" ADD CONSTRAINT "UserCategory_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
