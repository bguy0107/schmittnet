import { prisma } from "@/src/lib/prisma";
import type { VideoRequestStatus, RequestingParty } from "@schmittnet/types";
import type { Prisma } from "@prisma/client";

export interface ListVideoRequestsFilter {
  locationIds?: string[];
  status?: VideoRequestStatus;
  page?: number;
  pageSize?: number;
}

const videoRequestSummarySelect = {
  id: true,
  status: true,
  requestingParty: true,
  cameraAreas: true,
  footageStart: true,
  footageEnd: true,
  submitterName: true,
  submitterContact: true,
  createdAt: true,
  updatedAt: true,
  location: { select: { id: true, name: true } },
} satisfies Prisma.VideoRequestSelect;

const videoRequestDetailSelect = {
  ...videoRequestSummarySelect,
  officerContactDetails: true,
  internalContactDetails: true,
  resolutionNote: true,
  resolvedAt: true,
  resolvedBy: { select: { id: true, name: true } },
  cancellationNote: true,
  cancelledAt: true,
  cancelledBy: { select: { id: true, name: true } },
  submittedBy: { select: { id: true, name: true } },
} satisfies Prisma.VideoRequestSelect;

export type VideoRequestSummaryRow = Prisma.VideoRequestGetPayload<{ select: typeof videoRequestSummarySelect }>;
export type VideoRequestDetailRow = Prisma.VideoRequestGetPayload<{ select: typeof videoRequestDetailSelect }>;

export const videoRequestRepository = {
  async findMany(filter: ListVideoRequestsFilter) {
    const { page = 1, pageSize = 25, locationIds, status } = filter;

    const where: Prisma.VideoRequestWhereInput = {
      ...(locationIds ? { locationId: { in: locationIds } } : {}),
      ...(status ? { status } : {}),
    };

    const [rows, total] = await prisma.$transaction([
      prisma.videoRequest.findMany({
        where,
        select: videoRequestSummarySelect,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.videoRequest.count({ where }),
    ]);

    return { rows, total, page, pageSize };
  },

  async findById(id: string) {
    return prisma.videoRequest.findUnique({
      where: { id },
      select: videoRequestDetailSelect,
    });
  },

  async findByIdAndLocation(id: string, locationId: string) {
    return prisma.videoRequest.findFirst({
      where: { id, locationId },
      select: videoRequestDetailSelect,
    });
  },

  async create(data: {
    locationId: string;
    cameraAreas: string;
    footageStart: Date;
    footageEnd: Date;
    requestingParty: RequestingParty;
    officerContactDetails?: string;
    internalContactDetails?: string;
    submitterName: string;
    submitterContact: string;
    submittedById?: string | null;
  }) {
    return prisma.videoRequest.create({
      data: {
        locationId: data.locationId,
        cameraAreas: data.cameraAreas,
        footageStart: data.footageStart,
        footageEnd: data.footageEnd,
        requestingParty: data.requestingParty,
        officerContactDetails: data.officerContactDetails,
        internalContactDetails: data.internalContactDetails,
        submitterName: data.submitterName,
        submitterContact: data.submitterContact,
        submittedById: data.submittedById ?? undefined,
      },
      select: { id: true, createdAt: true, locationId: true },
    });
  },

  async resolve(id: string, resolvedById: string, resolutionNote: string) {
    return prisma.videoRequest.update({
      where: { id },
      data: {
        status: "RESOLVED",
        resolutionNote,
        resolvedById,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      },
      select: { id: true, status: true },
    });
  },

  async cancel(id: string, cancelledById: string | null, cancellationNote: string | null) {
    return prisma.videoRequest.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancellationNote: cancellationNote ?? undefined,
        cancelledById: cancelledById ?? undefined,
        cancelledAt: new Date(),
        updatedAt: new Date(),
      },
      select: { id: true, status: true },
    });
  },
};
