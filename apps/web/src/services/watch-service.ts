import { watcherRepository } from "@/src/repositories/watcher-repository";
import { ticketRepository } from "@/src/repositories/ticket-repository";
import { locationRepository } from "@/src/repositories/location-repository";
import { NotFoundError, ForbiddenError } from "@/src/lib/errors";
import type { Role } from "@schmittnet/types";

export const watchService = {
  async getStatus(ticketId: string, userId: string) {
    const watcher = await watcherRepository.findOne(ticketId, userId);
    return { isWatching: !!watcher };
  },

  async watch(
    ticketId: string,
    actorId: string,
    actorRole: Role,
    actorOwnerId: string | null,
  ) {
    await assertTicketAccess(ticketId, actorRole, actorOwnerId);
    return watcherRepository.upsert(ticketId, actorId);
  },

  async unwatch(ticketId: string, actorId: string) {
    await watcherRepository.remove(ticketId, actorId);
  },
};

async function assertTicketAccess(
  ticketId: string,
  actorRole: Role,
  actorOwnerId: string | null,
) {
  const ticket = await ticketRepository.findById(ticketId);
  if (!ticket) throw new NotFoundError("Ticket not found");

  if (actorRole === "OWNER" || actorRole === "OWNER_STAFF") {
    if (!actorOwnerId) throw new ForbiddenError("No owner context");
    const ownerIds = await locationRepository.getOwnerIdsByLocationIds([ticket.location.id]);
    if (!ownerIds.includes(actorOwnerId)) throw new ForbiddenError("Access denied");
  }
}
