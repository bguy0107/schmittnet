-- AlterTable
ALTER TABLE "users" ALTER COLUMN "notification_email" SET DEFAULT false;

-- Disable email notifications for all existing users
UPDATE "users" SET "notification_email" = false;
