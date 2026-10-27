-- CreateEnum
CREATE TYPE "SubmissionOutcome" AS ENUM ('PASSED', 'FAILED', 'PARTIAL', 'ERROR', 'TIMEOUT');

-- CreateTable
CREATE TABLE "ExerciseHint" (
    "id" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "ExerciseHint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseTest" (
    "id" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "spec" JSONB NOT NULL,
    "isHidden" BOOLEAN NOT NULL DEFAULT true,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,

    CONSTRAINT "ExerciseTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "code" TEXT,
    "answer" JSONB,
    "outcome" "SubmissionOutcome" NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "achievedLevel" INTEGER,
    "hintsUsed" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER,
    "errorCategory" TEXT,
    "selfExplanation" TEXT,
    "aiAssisted" BOOLEAN NOT NULL DEFAULT false,
    "aiInteractionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionTestResult" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "output" TEXT,
    "durationMs" INTEGER,

    CONSTRAINT "SubmissionTestResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseHint_exerciseId_level_key" ON "ExerciseHint"("exerciseId", "level");

-- CreateIndex
CREATE INDEX "ExerciseTest_exerciseId_idx" ON "ExerciseTest"("exerciseId");

-- CreateIndex
CREATE INDEX "Submission_userId_createdAt_idx" ON "Submission"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Submission_exerciseId_idx" ON "Submission"("exerciseId");

-- CreateIndex
CREATE INDEX "SubmissionTestResult_submissionId_idx" ON "SubmissionTestResult"("submissionId");

-- AddForeignKey
ALTER TABLE "ExerciseHint" ADD CONSTRAINT "ExerciseHint_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseTest" ADD CONSTRAINT "ExerciseTest_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionTestResult" ADD CONSTRAINT "SubmissionTestResult_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
