import { describe, it, expect, vi, beforeEach } from "vitest";
import { userService } from "./user-service";
import { userRepository } from "@/src/repositories/user-repository";
import { locationRepository } from "@/src/repositories/location-repository";
import { ValidationError } from "@/src/lib/errors";

vi.mock("@/src/repositories/user-repository");
vi.mock("@/src/repositories/location-repository");
vi.mock("@/src/services/notification-service");
vi.mock("@node-rs/argon2", () => ({ hash: vi.fn().mockResolvedValue("hashed") }));

const OWNER_ID = "11111111-1111-1111-1111-111111111111";
const LOC_1 = "22222222-2222-2222-2222-222222222222";
const LOC_2 = "33333333-3333-3333-3333-333333333333";
const LOC_OTHER = "44444444-4444-4444-4444-444444444444";

const baseUser = {
  id: "user-1",
  email: "staff@example.com",
  name: "Staff Member",
  role: "OWNER_STAFF",
  categories: [],
  notificationEmail: false,
  ownerId: OWNER_ID,
  isActive: true,
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  assignedLocationIds: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(userRepository.findByEmail).mockResolvedValue(null);
  vi.mocked(userRepository.create).mockResolvedValue(baseUser as never);
  vi.mocked(userRepository.update).mockResolvedValue(baseUser as never);
  vi.mocked(userRepository.findById).mockResolvedValue(baseUser as never);
  vi.mocked(locationRepository.getLocationIdsByOwner).mockResolvedValue([LOC_1, LOC_2]);
});

describe("userService.createUser", () => {
  const body = {
    email: "staff@example.com",
    name: "Staff Member",
    role: "OWNER_STAFF",
    ownerId: OWNER_ID,
    password: "password123",
  };

  it("rejects non-super-admins", async () => {
    await expect(userService.createUser("OWNER", body)).rejects.toThrow();
  });

  it("does not touch location assignments when none are provided", async () => {
    await userService.createUser("SUPER_ADMIN", body);
    expect(userRepository.setAssignedLocations).not.toHaveBeenCalled();
  });

  it("assigns valid locations belonging to the user's owner", async () => {
    await userService.createUser("SUPER_ADMIN", { ...body, assignedLocationIds: [LOC_1] });
    expect(userRepository.setAssignedLocations).toHaveBeenCalledWith("user-1", [LOC_1]);
  });

  it("rejects locations that don't belong to the user's owner", async () => {
    await expect(
      userService.createUser("SUPER_ADMIN", { ...body, assignedLocationIds: [LOC_OTHER] }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(userRepository.setAssignedLocations).not.toHaveBeenCalled();
  });

  it("clears any provided locations for non-OWNER_STAFF roles", async () => {
    vi.mocked(userRepository.create).mockResolvedValue({ ...baseUser, role: "TECHNICIAN" } as never);
    await userService.createUser("SUPER_ADMIN", {
      ...body,
      role: "TECHNICIAN",
      assignedLocationIds: [LOC_1],
    });
    expect(userRepository.setAssignedLocations).toHaveBeenCalledWith("user-1", []);
  });
});

describe("userService.updateUser", () => {
  it("updates assigned locations for an OWNER_STAFF user", async () => {
    await userService.updateUser("user-1", "SUPER_ADMIN", { assignedLocationIds: [LOC_2] });
    expect(userRepository.setAssignedLocations).toHaveBeenCalledWith("user-1", [LOC_2]);
  });

  it("rejects locations that don't belong to the user's owner", async () => {
    await expect(
      userService.updateUser("user-1", "SUPER_ADMIN", { assignedLocationIds: [LOC_OTHER] }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("clears assignments when the role changes away from OWNER_STAFF", async () => {
    vi.mocked(userRepository.update).mockResolvedValue({ ...baseUser, role: "TECHNICIAN" } as never);
    await userService.updateUser("user-1", "SUPER_ADMIN", { role: "TECHNICIAN" });
    expect(userRepository.setAssignedLocations).toHaveBeenCalledWith("user-1", []);
  });

  it("does not touch assignments when nothing relevant changes", async () => {
    await userService.updateUser("user-1", "SUPER_ADMIN", { name: "New Name" });
    expect(userRepository.setAssignedLocations).not.toHaveBeenCalled();
  });
});
