-- AlterTable
ALTER TABLE "Event" ADD COLUMN "googleEventId" TEXT,
ADD COLUMN "isAllDay" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'confirmed';

-- CreateIndex
CREATE INDEX "Event_googleEventId_idx" ON "Event"("googleEventId");
