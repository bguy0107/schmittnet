-- AlterTable: collapse three LE columns into one free-text field
ALTER TABLE "video_requests" DROP COLUMN "le_case_number",
                             DROP COLUMN "le_officer_name",
                             DROP COLUMN "le_agency";

ALTER TABLE "video_requests" ADD COLUMN "officer_contact_details" TEXT;
