-- CreateTable
CREATE TABLE "representant_comments" (
    "id" TEXT NOT NULL,
    "representantId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "clientCreatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "isDemo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "representant_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "representant_comments_representantId_clientCreatedAt_idx" ON "representant_comments"("representantId", "clientCreatedAt");

-- CreateIndex
CREATE INDEX "representant_comments_authorId_createdAt_idx" ON "representant_comments"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "representant_comments_isDemo_idx" ON "representant_comments"("isDemo");

-- AddForeignKey
ALTER TABLE "representant_comments" ADD CONSTRAINT "representant_comments_representantId_fkey" FOREIGN KEY ("representantId") REFERENCES "representants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "representant_comments" ADD CONSTRAINT "representant_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
