-- Add missing DB-level default for UserProfile.id
ALTER TABLE "UserProfile" ALTER COLUMN "id" SET DEFAULT 'default';
