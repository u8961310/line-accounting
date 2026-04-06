-- AlterTable: 加入 dueTime 欄位
ALTER TABLE "Task" ADD COLUMN "dueTime" TEXT NOT NULL DEFAULT '';
