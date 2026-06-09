"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLocationContext } from "@/hooks/use-dashboard";
import { useSubmitVideoRequest } from "@/hooks/use-video-requests";
import type { SubmitVideoRequestResponse } from "@schmittnet/types";

const schema = z
  .object({
    submitterName: z.string().min(1, "Your name is required").max(100),
    submitterContact: z.string().min(1, "Contact information is required").max(200),
    cameraAreas: z.string().min(1, "Camera or area is required").max(500),
    footageStart: z.string().min(1, "Start date/time is required"),
    footageEnd: z.string().min(1, "End date/time is required"),
    requestingParty: z.enum(["LAW_ENFORCEMENT", "INTERNAL"], {
      errorMap: () => ({ message: "Please select the requesting party" }),
    }),
    officerContactDetails: z.string().max(500).optional(),
    internalContactDetails: z.string().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.requestingParty === "LAW_ENFORCEMENT") {
      if (!data.officerContactDetails?.trim()) {
        ctx.addIssue({ code: "custom", path: ["officerContactDetails"], message: "Officer contact details are required" });
      }
    }
    if (data.requestingParty === "INTERNAL") {
      if (!data.internalContactDetails?.trim()) {
        ctx.addIssue({ code: "custom", path: ["internalContactDetails"], message: "Internal contact details are required" });
      }
    }
    if (data.footageStart && data.footageEnd && data.footageEnd <= data.footageStart) {
      ctx.addIssue({ code: "custom", path: ["footageEnd"], message: "End must be after start" });
    }
  });

type FormData = z.infer<typeof schema>;

export function VideoRequestSubmitForm({ token }: { token: string }) {
  const { data: location, isLoading: locationLoading, isError: locationError } = useLocationContext(token);
  const submitRequest = useSubmitVideoRequest(token);
  const [confirmation, setConfirmation] = useState<SubmitVideoRequestResponse | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const requestingParty = watch("requestingParty");

  async function onSubmit(data: FormData) {
    const result = await submitRequest.mutateAsync({
      submitterName: data.submitterName,
      submitterContact: data.submitterContact,
      cameraAreas: data.cameraAreas,
      footageStart: new Date(data.footageStart).toISOString(),
      footageEnd: new Date(data.footageEnd).toISOString(),
      requestingParty: data.requestingParty,
      officerContactDetails: data.officerContactDetails || undefined,
      internalContactDetails: data.internalContactDetails || undefined,
    });
    setConfirmation(result);
  }

  if (locationLoading) {
    return <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">Loading…</div>;
  }

  if (locationError || !location) {
    return (
      <Alert variant="destructive">
        <AlertDescription>This QR code is no longer active. Please contact your manager.</AlertDescription>
      </Alert>
    );
  }

  if (confirmation) {
    return (
      <div className="rounded-lg bg-white p-8 text-center shadow-sm dark:bg-gray-900">
        <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-500" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Request submitted!</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Your reference code is{" "}
          <strong className="font-mono text-base text-gray-900 dark:text-gray-100">{confirmation.referenceCode}</strong>
          . Keep this in case you need to follow up.
        </p>
      </div>
    );
  }

  const isDisabled = isSubmitting || submitRequest.isPending;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 rounded-lg bg-white p-6 shadow-sm dark:bg-gray-900" noValidate>
      <div className="rounded-md bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-200">
        📍 {location.name}
      </div>

      {submitRequest.isError && (
        <Alert variant="destructive">
          <AlertDescription>
            {submitRequest.error instanceof Error ? submitRequest.error.message : "Submission failed. Please try again."}
          </AlertDescription>
        </Alert>
      )}

      {/* Submitter info */}
      <div className="space-y-1.5">
        <Label htmlFor="submitterName">
          Your name <span aria-hidden="true" className="text-destructive">*</span>
        </Label>
        <Input
          id="submitterName"
          placeholder="First and last name"
          aria-invalid={!!errors.submitterName}
          {...register("submitterName")}
        />
        {errors.submitterName && <p className="text-xs text-destructive">{errors.submitterName.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="submitterContact">
          Contact information <span aria-hidden="true" className="text-destructive">*</span>
        </Label>
        <Input
          id="submitterContact"
          placeholder="Phone number or email"
          aria-invalid={!!errors.submitterContact}
          {...register("submitterContact")}
        />
        {errors.submitterContact && <p className="text-xs text-destructive">{errors.submitterContact.message}</p>}
      </div>

      {/* Requesting party */}
      <div className="space-y-2">
        <Label>
          Requesting party <span aria-hidden="true" className="text-destructive">*</span>
        </Label>
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

      {/* Law enforcement fields */}
      {requestingParty === "LAW_ENFORCEMENT" && (
        <div className="space-y-3 rounded-md border border-gray-200 p-4 dark:border-gray-700">
          <div className="space-y-1.5">
            <Label htmlFor="officerContactDetails">
              Officer Contact Details <span aria-hidden="true" className="text-destructive">*</span>
            </Label>
            <Textarea
              id="officerContactDetails"
              placeholder="e.g. Case #1234, Officer J. Smith, Metro PD"
              rows={3}
              aria-invalid={!!errors.officerContactDetails}
              {...register("officerContactDetails")}
            />
            {errors.officerContactDetails && <p className="text-xs text-destructive">{errors.officerContactDetails.message}</p>}
          </div>
        </div>
      )}

      {/* Internal contact fields */}
      {requestingParty === "INTERNAL" && (
        <div className="space-y-3 rounded-md border border-gray-200 p-4 dark:border-gray-700">
          <div className="space-y-1.5">
            <Label htmlFor="internalContactDetails">
              Internal Contact Details <span aria-hidden="true" className="text-destructive">*</span>
            </Label>
            <Textarea
              id="internalContactDetails"
              placeholder="e.g. Manager on duty, department, phone extension"
              rows={3}
              aria-invalid={!!errors.internalContactDetails}
              {...register("internalContactDetails")}
            />
            {errors.internalContactDetails && <p className="text-xs text-destructive">{errors.internalContactDetails.message}</p>}
          </div>
        </div>
      )}

      {/* Camera / area */}
      <div className="space-y-1.5">
        <Label htmlFor="cameraAreas">
          Camera # or area <span aria-hidden="true" className="text-destructive">*</span>
        </Label>
        <Input
          id="cameraAreas"
          placeholder="e.g. Camera 3, Front entrance, Parking lot"
          aria-invalid={!!errors.cameraAreas}
          {...register("cameraAreas")}
        />
        {errors.cameraAreas && <p className="text-xs text-destructive">{errors.cameraAreas.message}</p>}
      </div>

      {/* Date/time range */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="footageStart">
            Start date &amp; time <span aria-hidden="true" className="text-destructive">*</span>
          </Label>
          <input
            id="footageStart"
            type="datetime-local"
            aria-invalid={!!errors.footageStart}
            className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            {...register("footageStart")}
          />
          {errors.footageStart && <p className="text-xs text-destructive">{errors.footageStart.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="footageEnd">
            End date &amp; time <span aria-hidden="true" className="text-destructive">*</span>
          </Label>
          <input
            id="footageEnd"
            type="datetime-local"
            aria-invalid={!!errors.footageEnd}
            className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            {...register("footageEnd")}
          />
          {errors.footageEnd && <p className="text-xs text-destructive">{errors.footageEnd.message}</p>}
        </div>
      </div>

      <Button type="submit" className="w-full" size="lg" disabled={isDisabled}>
        {isDisabled ? "Submitting…" : "Submit request"}
      </Button>
    </form>
  );
}
