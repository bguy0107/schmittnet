"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateVideoRequest } from "@/hooks/use-video-requests";

const schema = z
  .object({
    locationId: z.string().min(1, "Select a location"),
    submitterName: z.string().min(1, "Your name is required").max(100),
    cameraAreas: z.string().min(1, "Camera or area is required").max(500),
    footageStart: z.string().min(1, "Start date/time is required"),
    footageEnd: z.string().min(1, "End date/time is required"),
    requestingParty: z.enum(["LAW_ENFORCEMENT", "INTERNAL"], {
      errorMap: () => ({ message: "Select the requesting party" }),
    }),
    officerContactDetails: z.string().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.requestingParty === "LAW_ENFORCEMENT") {
      if (!data.officerContactDetails?.trim()) ctx.addIssue({ code: "custom", path: ["officerContactDetails"], message: "Officer contact details are required" });
    }
    if (data.footageStart && data.footageEnd && data.footageEnd <= data.footageStart) {
      ctx.addIssue({ code: "custom", path: ["footageEnd"], message: "End must be after start" });
    }
  });

type FormData = z.infer<typeof schema>;

export function OpenVideoRequestPanel({
  locations,
  onClose,
}: {
  locations: { id: string; name: string }[];
  onClose: () => void;
}) {
  const createRequest = useCreateVideoRequest();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const requestingParty = watch("requestingParty");

  async function onSubmit(data: FormData) {
    await createRequest.mutateAsync({
      locationId: data.locationId,
      submitterName: data.submitterName,
      cameraAreas: data.cameraAreas,
      footageStart: new Date(data.footageStart).toISOString(),
      footageEnd: new Date(data.footageEnd).toISOString(),
      requestingParty: data.requestingParty,
      officerContactDetails: data.officerContactDetails || undefined,
    });
    onClose();
  }

  const isDisabled = isSubmitting || createRequest.isPending;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col overflow-y-auto bg-white shadow-xl dark:bg-gray-900">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">New Video Request</h2>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0 text-lg leading-none">
            ✕
          </Button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 space-y-5 p-4">
          {createRequest.isError && (
            <Alert variant="destructive">
              <AlertDescription>
                {createRequest.error instanceof Error ? createRequest.error.message : "Submission failed."}
              </AlertDescription>
            </Alert>
          )}

          {/* Location */}
          <div className="space-y-1">
            <Label htmlFor="vr-location">
              Location <span aria-hidden="true" className="text-destructive">*</span>
            </Label>
            <select
              id="vr-location"
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring dark:bg-gray-900"
              {...register("locationId")}
            >
              <option value="">— Select location —</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
            {errors.locationId && <p className="text-xs text-destructive">{errors.locationId.message}</p>}
          </div>

          {/* Submitter */}
          <div className="space-y-1.5">
            <Label htmlFor="vr-name">
              Your name <span aria-hidden="true" className="text-destructive">*</span>
            </Label>
            <Input id="vr-name" placeholder="First and last name" aria-invalid={!!errors.submitterName} {...register("submitterName")} />
            {errors.submitterName && <p className="text-xs text-destructive">{errors.submitterName.message}</p>}
          </div>

          {/* Requesting party */}
          <div className="space-y-2">
            <Label>Requesting party <span aria-hidden="true" className="text-destructive">*</span></Label>
            <div className="grid grid-cols-2 gap-3">
              {(["INTERNAL", "LAW_ENFORCEMENT"] as const).map((party) => (
                <label
                  key={party}
                  className="flex cursor-pointer items-center justify-center rounded-md border-2 p-3 text-sm font-medium transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                >
                  <input type="radio" value={party} {...register("requestingParty")} className="sr-only" />
                  {party === "INTERNAL" ? "Internal" : "Law Enforcement"}
                </label>
              ))}
            </div>
            {errors.requestingParty && <p className="text-xs text-destructive">{errors.requestingParty.message}</p>}
          </div>

          {/* LE fields */}
          {requestingParty === "LAW_ENFORCEMENT" && (
            <div className="space-y-1.5 rounded-md border border-gray-200 p-3 dark:border-gray-700">
              <Label htmlFor="vr-officer-contact">
                Officer Contact Details <span aria-hidden="true" className="text-destructive">*</span>
              </Label>
              <Textarea
                id="vr-officer-contact"
                placeholder="e.g. Case #1234, Officer J. Smith, Metro PD"
                rows={3}
                aria-invalid={!!errors.officerContactDetails}
                {...register("officerContactDetails")}
              />
              {errors.officerContactDetails && <p className="text-xs text-destructive">{errors.officerContactDetails.message}</p>}
            </div>
          )}

          {/* Camera / area */}
          <div className="space-y-1.5">
            <Label htmlFor="vr-camera">
              Camera # or area <span aria-hidden="true" className="text-destructive">*</span>
            </Label>
            <Input id="vr-camera" placeholder="e.g. Camera 3, Front entrance" aria-invalid={!!errors.cameraAreas} {...register("cameraAreas")} />
            {errors.cameraAreas && <p className="text-xs text-destructive">{errors.cameraAreas.message}</p>}
          </div>

          {/* Date/time range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="vr-start">Start <span aria-hidden="true" className="text-destructive">*</span></Label>
              <input
                id="vr-start"
                type="datetime-local"
                aria-invalid={!!errors.footageStart}
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register("footageStart")}
              />
              {errors.footageStart && <p className="text-xs text-destructive">{errors.footageStart.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vr-end">End <span aria-hidden="true" className="text-destructive">*</span></Label>
              <input
                id="vr-end"
                type="datetime-local"
                aria-invalid={!!errors.footageEnd}
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register("footageEnd")}
              />
              {errors.footageEnd && <p className="text-xs text-destructive">{errors.footageEnd.message}</p>}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1" disabled={isDisabled}>
              {isDisabled ? "Submitting…" : "Submit request"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose} disabled={isDisabled}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
