-- CreateEnum
CREATE TYPE "HistoryEntryType" AS ENUM ('NOTE', 'STATUS_CHANGE');

-- Rename table
ALTER TABLE "ticket_notes" RENAME TO "ticket_history";

-- Rename primary key constraint
ALTER INDEX "ticket_notes_pkey" RENAME TO "ticket_history_pkey";

-- Recreate FK constraints with correct names (drop old ones first)
ALTER TABLE "ticket_history" DROP CONSTRAINT "ticket_notes_ticket_id_fkey";
ALTER TABLE "ticket_history" ADD CONSTRAINT "ticket_history_ticket_id_fkey"
  FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ticket_history" DROP CONSTRAINT "ticket_notes_author_id_fkey";
ALTER TABLE "ticket_history" ADD CONSTRAINT "ticket_history_author_id_fkey"
  FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add new columns (existing rows become type=NOTE which is correct — they were all notes)
ALTER TABLE "ticket_history" ADD COLUMN "type" "HistoryEntryType" NOT NULL DEFAULT 'NOTE';
ALTER TABLE "ticket_history" ADD COLUMN "from_status" "TicketStatus";
ALTER TABLE "ticket_history" ADD COLUMN "to_status" "TicketStatus";

-- Make content nullable (STATUS_CHANGE entries don't carry text)
ALTER TABLE "ticket_history" ALTER COLUMN "content" DROP NOT NULL;
