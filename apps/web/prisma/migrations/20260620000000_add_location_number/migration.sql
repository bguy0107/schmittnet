-- AlterTable
ALTER TABLE "locations" ADD COLUMN "location_number" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "locations_location_number_key" ON "locations"("location_number");
