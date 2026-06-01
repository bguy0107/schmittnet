import { describe, it, expect, vi, beforeEach } from "vitest";
import { ticketService } from "./ticket-service";
import { locationRepository } from "@/src/repositories/location-repository";
import { NotFoundError, ValidationError } from "@/src/lib/errors";

vi.mock("@/src/repositories/location-repository");
vi.mock("@/src/repositories/ticket-repository");
vi.mock("@/src/services/notification-service");

const mockLocation = { id: "loc-1", name: "Test Location", ownerId: "owner-1" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(locationRepository.findByToken).mockResolvedValue(mockLocation);
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
