-- CreateEnum
CREATE TYPE "ReleaseStatus" AS ENUM ('DRAFT', 'ANALYZED', 'IN_REVIEW', 'FINAL');

-- CreateEnum
CREATE TYPE "ReleaseItemType" AS ENUM ('FEATURE', 'BUG_FIX', 'BEHAVIOR_CHANGE', 'QA_EVIDENCE', 'LIMITATION', 'MIGRATION_NOTE', 'AFFECTED_GROUP');

-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "Audience" AS ENUM ('INTERNAL', 'CLIENT');

-- CreateEnum
CREATE TYPE "Impact" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "SupportStatus" AS ENUM ('SUPPORTED', 'PARTIALLY_SUPPORTED', 'UNSUPPORTED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "releases" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "ReleaseStatus" NOT NULL DEFAULT 'DRAFT',
    "parentReleaseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "releases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "release_items" (
    "id" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "itemType" "ReleaseItemType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "contentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "release_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_analyses" (
    "id" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "status" "AnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "model" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "error" TEXT,
    "resultJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generated_statements" (
    "id" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "audience" "Audience" NOT NULL,
    "statement" TEXT NOT NULL,
    "impact" "Impact" NOT NULL,
    "supportStatus" "SupportStatus" NOT NULL DEFAULT 'UNSUPPORTED',
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "isStale" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generated_statements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statement_evidence" (
    "statementId" TEXT NOT NULL,
    "releaseItemId" TEXT NOT NULL,
    "sourceHashAtGeneration" TEXT NOT NULL,

    CONSTRAINT "statement_evidence_pkey" PRIMARY KEY ("statementId","releaseItemId")
);

-- AddForeignKey
ALTER TABLE "releases" ADD CONSTRAINT "releases_parentReleaseId_fkey" FOREIGN KEY ("parentReleaseId") REFERENCES "releases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "release_items" ADD CONSTRAINT "release_items_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "releases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "releases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_statements" ADD CONSTRAINT "generated_statements_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "releases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statement_evidence" ADD CONSTRAINT "statement_evidence_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "generated_statements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statement_evidence" ADD CONSTRAINT "statement_evidence_releaseItemId_fkey" FOREIGN KEY ("releaseItemId") REFERENCES "release_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
