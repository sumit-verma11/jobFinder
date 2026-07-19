-- CreateEnum
CREATE TYPE "SourceKind" AS ENUM ('CAREERS_PAGE', 'ATS');

-- CreateEnum
CREATE TYPE "AtsPlatform" AS ENUM ('GREENHOUSE', 'LEVER', 'ASHBY', 'WORKABLE');

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "SourceKind" NOT NULL,
    "url" TEXT,
    "platform" "AtsPlatform",
    "slug" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN "jobTitleKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[];
