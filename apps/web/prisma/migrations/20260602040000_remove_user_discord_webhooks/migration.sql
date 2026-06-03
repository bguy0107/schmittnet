-- AlterTable
ALTER TABLE "users" DROP COLUMN IF EXISTS "notification_discord";

-- AlterTable
ALTER TABLE "ticket_watchers" DROP COLUMN IF EXISTS "webhook_url";
