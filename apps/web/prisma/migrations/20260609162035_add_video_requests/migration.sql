-- CreateEnum
CREATE TYPE "VideoRequestStatus" AS ENUM ('OPEN', 'RESOLVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RequestingParty" AS ENUM ('LAW_ENFORCEMENT', 'INTERNAL');

-- CreateTable
CREATE TABLE "video_requests" (
    "id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "camera_areas" TEXT NOT NULL,
    "footage_start" TIMESTAMP(3) NOT NULL,
    "footage_end" TIMESTAMP(3) NOT NULL,
    "requesting_party" "RequestingParty" NOT NULL,
    "le_case_number" TEXT,
    "le_officer_name" TEXT,
    "le_agency" TEXT,
    "submitter_name" TEXT NOT NULL,
    "submitter_contact" TEXT NOT NULL,
    "submitted_by_id" TEXT,
    "status" "VideoRequestStatus" NOT NULL DEFAULT 'OPEN',
    "resolution_note" TEXT,
    "resolved_by_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "cancellation_note" TEXT,
    "cancelled_by_id" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_requests_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "video_requests" ADD CONSTRAINT "video_requests_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_requests" ADD CONSTRAINT "video_requests_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_requests" ADD CONSTRAINT "video_requests_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_requests" ADD CONSTRAINT "video_requests_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
