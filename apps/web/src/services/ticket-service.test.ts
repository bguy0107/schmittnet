import { describe, it, expect, vi, beforeEach } from "vitest";
import { ticketService } from "./ticket-service";
import { locationRepository } from "@/src/repositories/location-repository";
import { ticketRepository } from "@/src/repositories/ticket-repository";
import { userRepository } from "@/src/repositories/user-repository";
import { deleteObjects } from "@/src/lib/minio";
import { NotFoundError, ForbiddenError } from "@/src/lib/errors";

vi.mock("@/src/repositories/location-repository");
vi.mock("@/src/repositories/ticket-repository");
vi.mock("@/src/repositories/user-repository");
vi.mock("@/src/services/notification-service");
vi.mock("@/src/lib/minio", () => ({
  getSignedReadUrl: vi.fn().mockResolvedValue("https://example.com/signed"),
  deleteObjects: vi.fn().mockResolvedValue(undefined),
}));

const mockLocation = { id: "loc-1", name: "Test Location", ownerId: "owner-1" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(locationRepository.findByToken).mockResolvedValue(mockLocation);
  vi.mocked(locationRepository.getOwnerIdsByLocationIds).mockResolvedValue(["owner-1"]);
});

describe("ticketService.getLocationContext", () => {
  it("returns location for an active token", async () => {
    const result = await ticketService.getLocationContext("valid-token");
    expect(result).toEqual(mockLocation);
  });

  it("throws NotFoundError for an invalid or inactive token", async () => {
    vi.mocked(locationRepository.findByToken).mockResolvedValue(null);
    await expect(ticketService.getLocationContext("bad-token")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe("ticketService.submitTicket", () => {
  it("rejects a submission with no media keys", async () => {
    await expect(
      ticketService.submitTicket("valid-token", {
        category: "IT",
        description: "POS terminal is broken — screen is black",
        mediaKeys: [], // violates min(1) rule
      }),
    ).rejects.toThrow(); // ZodError
  });

  it("rejects a description that is too short", async () => {
    await expect(
      ticketService.submitTicket("valid-token", {
        category: "IT",
        description: "Broken", // too short
        mediaKeys: ["key1"],
      }),
    ).rejects.toThrow();
  });
});

describe("ticketService.getCleanupPreview", () => {
  it("rejects non-super-admins", async () => {
    await expect(ticketService.getCleanupPreview("TECHNICIAN")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("returns the count of resolved/cancelled tickets", async () => {
    vi.mocked(ticketRepository.countByStatuses).mockResolvedValue(7);

    await expect(ticketService.getCleanupPreview("SUPER_ADMIN")).resolves.toEqual({ count: 7 });
    expect(ticketRepository.countByStatuses).toHaveBeenCalledWith(["RESOLVED", "CANCELLED"]);
  });
});

describe("ticketService.purgeResolvedAndCancelled", () => {
  it("rejects non-super-admins", async () => {
    await expect(
      ticketService.purgeResolvedAndCancelled("OWNER", "user-1"),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(ticketRepository.purgeByStatuses).not.toHaveBeenCalled();
  });

  it("purges matching tickets and removes their media from storage", async () => {
    vi.mocked(ticketRepository.purgeByStatuses).mockResolvedValue({
      count: 3,
      storageKeys: ["a.jpg", "b.mp4"],
    });

    const result = await ticketService.purgeResolvedAndCancelled("SUPER_ADMIN", "admin-1");

    expect(ticketRepository.purgeByStatuses).toHaveBeenCalledWith(["RESOLVED", "CANCELLED"]);
    expect(deleteObjects).toHaveBeenCalledWith(["a.jpg", "b.mp4"]);
    expect(result).toEqual({ deletedCount: 3 });
  });

  it("skips storage cleanup when there is no media to remove", async () => {
    vi.mocked(ticketRepository.purgeByStatuses).mockResolvedValue({ count: 1, storageKeys: [] });

    await ticketService.purgeResolvedAndCancelled("SUPER_ADMIN", "admin-1");

    expect(deleteObjects).not.toHaveBeenCalled();
  });
});

describe("ticketService.resolveApproval", () => {
  const mockTicket = {
    id: "ticket-1",
    locationId: "loc-1",
    location: { id: "loc-1", name: "Test Location" },
    status: "AWAITING_APPROVAL",
  };

  beforeEach(() => {
    vi.mocked(ticketRepository.findById).mockResolvedValue(mockTicket as never);
    vi.mocked(ticketRepository.resolveApproval).mockResolvedValue({
      ticket: { locationId: "loc-1" },
      requester: { id: "tech-1" },
    } as never);
  });

  it("rejects roles other than OWNER/OWNER_STAFF/SUPER_ADMIN", async () => {
    await expect(
      ticketService.resolveApproval("ticket-1", "approval-1", "tech-1", "TECHNICIAN", null, {
        status: "APPROVED",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("allows an OWNER_STAFF user with no location assignments to approve any of the owner's locations", async () => {
    vi.mocked(userRepository.getAssignedLocationIds).mockResolvedValue([]);

    await expect(
      ticketService.resolveApproval("ticket-1", "approval-1", "staff-1", "OWNER_STAFF", "owner-1", {
        status: "APPROVED",
      }),
    ).resolves.toBeDefined();
  });

  it("allows an OWNER_STAFF user assigned to the ticket's location to approve", async () => {
    vi.mocked(userRepository.getAssignedLocationIds).mockResolvedValue(["loc-1", "loc-2"]);

    await expect(
      ticketService.resolveApproval("ticket-1", "approval-1", "staff-1", "OWNER_STAFF", "owner-1", {
        status: "APPROVED",
      }),
    ).resolves.toBeDefined();
  });

  it("rejects an OWNER_STAFF user who is assigned to other locations but not this one", async () => {
    vi.mocked(userRepository.getAssignedLocationIds).mockResolvedValue(["loc-2", "loc-3"]);

    await expect(
      ticketService.resolveApproval("ticket-1", "approval-1", "staff-1", "OWNER_STAFF", "owner-1", {
        status: "APPROVED",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(ticketRepository.resolveApproval).not.toHaveBeenCalled();
  });

  it("does not consult location assignments for OWNER", async () => {
    await expect(
      ticketService.resolveApproval("ticket-1", "approval-1", "owner-1", "OWNER", "owner-1", {
        status: "APPROVED",
      }),
    ).resolves.toBeDefined();
    expect(userRepository.getAssignedLocationIds).not.toHaveBeenCalled();
  });
});
