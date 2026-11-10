-- CreateEnum
CREATE TYPE "ExamMode" AS ENUM ('FORM_A', 'FORM_B', 'FORM_C', 'RANDOM', 'DOMAIN');

-- CreateEnum
CREATE TYPE "ExamAttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'EXPIRED');

-- CreateTable
CREATE TABLE "ExamForm" (
    "id" TEXT NOT NULL,
    "certification" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "exerciseSlugs" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "certification" TEXT NOT NULL,
    "mode" "ExamMode" NOT NULL,
    "domain" INTEGER,
    "extraTime" BOOLEAN NOT NULL DEFAULT false,
    "status" "ExamAttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "orientative" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "correctCount" INTEGER,
    "scorePct" INTEGER,
    "domainScores" JSONB,

    CONSTRAINT "ExamAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamAttemptItem" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "domain" INTEGER NOT NULL,
    "answer" JSONB,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "correct" BOOLEAN,
    "answeredAt" TIMESTAMP(3),

    CONSTRAINT "ExamAttemptItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RealExamResult" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "certification" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "scaledScore" INTEGER,
    "takenOn" DATE NOT NULL,
    "readyAtRegistration" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RealExamResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExamForm_certification_code_key" ON "ExamForm"("certification", "code");

-- CreateIndex
CREATE INDEX "ExamAttempt_userId_certification_startedAt_idx" ON "ExamAttempt"("userId", "certification", "startedAt");

-- CreateIndex
CREATE INDEX "ExamAttempt_certification_status_idx" ON "ExamAttempt"("certification", "status");

-- CreateIndex
CREATE INDEX "ExamAttemptItem_exerciseId_idx" ON "ExamAttemptItem"("exerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamAttemptItem_attemptId_position_key" ON "ExamAttemptItem"("attemptId", "position");

-- CreateIndex
CREATE INDEX "RealExamResult_userId_certification_idx" ON "RealExamResult"("userId", "certification");

-- CreateIndex
CREATE INDEX "RealExamResult_certification_createdAt_idx" ON "RealExamResult"("certification", "createdAt");

-- AddForeignKey
ALTER TABLE "ExamAttempt" ADD CONSTRAINT "ExamAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamAttemptItem" ADD CONSTRAINT "ExamAttemptItem_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "ExamAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamAttemptItem" ADD CONSTRAINT "ExamAttemptItem_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RealExamResult" ADD CONSTRAINT "RealExamResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
