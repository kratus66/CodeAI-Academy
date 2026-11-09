-- CreateEnum
CREATE TYPE "ExamPool" AS ENUM ('UNIT', 'RESERVED');

-- AlterTable
ALTER TABLE "Exercise" ADD COLUMN     "certification" TEXT,
ADD COLUMN     "examDomain" INTEGER,
ADD COLUMN     "examPool" "ExamPool" NOT NULL DEFAULT 'UNIT',
ADD COLUMN     "examTask" TEXT;

-- CreateIndex
CREATE INDEX "Exercise_certification_examDomain_examPool_idx" ON "Exercise"("certification", "examDomain", "examPool");
