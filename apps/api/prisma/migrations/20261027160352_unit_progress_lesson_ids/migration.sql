-- AlterTable
ALTER TABLE "UnitProgress" ADD COLUMN     "completedLessonIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
