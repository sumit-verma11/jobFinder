-- AlterTable
ALTER TABLE "Job" ADD COLUMN "coldMessage" TEXT;

-- AlterTable
ALTER TABLE "Application" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;

-- CreateEnum
CREATE TYPE "WorkMode" AS ENUM ('REMOTE', 'HYBRID', 'ONSITE');

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "profileText" TEXT NOT NULL,
    "styleExamplesText" TEXT,
    "preferredLocations" TEXT[],
    "workMode" "WorkMode" NOT NULL DEFAULT 'REMOTE',
    "expectedSalary" TEXT,
    "noticePeriod" TEXT,
    "resumeFileName" TEXT,
    "resumeFilePath" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- AlterEnum
-- This is an existing enum, create a new enum with the updated values
CREATE TYPE "AppStatus_new" AS ENUM ('SAVED', 'APPLIED', 'RECRUITER_VIEWED', 'OA_RECEIVED', 'INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED', 'OFFER', 'REJECTED', 'WITHDRAWN');

-- Alter the Application table to use the new enum
-- First, drop the default constraint
ALTER TABLE "Application" ALTER COLUMN "status" DROP DEFAULT;

-- Then cast the column to the new enum type
ALTER TABLE "Application" ALTER COLUMN "status" TYPE "AppStatus_new" USING ("status"::text::"AppStatus_new");

-- Re-add the default constraint
ALTER TABLE "Application" ALTER COLUMN "status" SET DEFAULT 'SAVED'::"AppStatus_new";

-- Drop the old enum type
DROP TYPE "AppStatus";

-- Rename the new enum type to the original name
ALTER TYPE "AppStatus_new" RENAME TO "AppStatus";
