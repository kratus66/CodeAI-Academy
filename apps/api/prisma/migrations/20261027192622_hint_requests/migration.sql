-- CreateTable
CREATE TABLE "HintRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "requests" INTEGER NOT NULL DEFAULT 1,
    "lastRequestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HintRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HintRequest_userId_exerciseId_idx" ON "HintRequest"("userId", "exerciseId");

-- CreateIndex
CREATE INDEX "HintRequest_exerciseId_idx" ON "HintRequest"("exerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "HintRequest_userId_exerciseId_level_key" ON "HintRequest"("userId", "exerciseId", "level");

-- AddForeignKey
ALTER TABLE "HintRequest" ADD CONSTRAINT "HintRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HintRequest" ADD CONSTRAINT "HintRequest_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;
