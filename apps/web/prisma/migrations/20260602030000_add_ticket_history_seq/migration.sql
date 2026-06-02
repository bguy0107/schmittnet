-- Add seq auto-increment to ticket_history for deterministic ordering.
-- PostgreSQL fills existing rows with sequential values from the new sequence,
-- so historical entries maintain a stable (if arbitrary) order.
ALTER TABLE "ticket_history" ADD COLUMN "seq" SERIAL NOT NULL;
