-- Allow ticket notes without an author (public/unauthenticated submissions)
ALTER TABLE "ticket_notes" ALTER COLUMN "author_id" DROP NOT NULL;
