import { describe, it, expect, vi, beforeEach } from "vitest";
import { locationService } from "./location-service";
import { locationRepository } from "@/src/repositories/location-repository";
import { ForbiddenError, NotFoundError } from "@/src/lib/errors";

vi.mock("@/src/repositories/location-repository");

const mockLocation = {
  id: "loc-1",
  name: "Test Location",
  locationNumber: 1,
  address: null,
  qrToken: "token",
  qrActive: true,
  owner: { id: "owner-1", name: "Owner One" },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(locationRepository.findById).mockResolvedValue(mockLocation);
});

describe("locationService.getLocation", () => {
  it("returns the location for a super-admin", async () => {
    await expect(locationService.getLocation("loc-1", "SUPER_ADMIN", null)).resolves.toEqual(
      mockLocation,
    );
  });

  it("returns the location for an owner who owns it", async () => {
    await expect(
      locationService.getLocation("loc-1", "OWNER", "owner-1"),
    ).resolves.toEqual(mockLocation);
  });

  it("returns the location for owner staff who owns it", async () => {
    await expect(
      locationService.getLocation("loc-1", "OWNER_STAFF", "owner-1"),
    ).resolves.toEqual(mockLocation);
  });

  it("rejects an owner who does not own the location", async () => {
    await expect(
      locationService.getLocation("loc-1", "OWNER", "owner-2"),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("rejects an owner with no owner context", async () => {
    await expect(
      locationService.getLocation("loc-1", "OWNER", null),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("rejects a technician", async () => {
    await expect(
      locationService.getLocation("loc-1", "TECHNICIAN", null),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("throws NotFoundError when the location does not exist", async () => {
    vi.mocked(locationRepository.findById).mockResolvedValue(null);
    await expect(
      locationService.getLocation("missing", "SUPER_ADMIN", null),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
