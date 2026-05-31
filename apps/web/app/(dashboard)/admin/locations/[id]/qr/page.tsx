import { redirect, notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import QRCode from "qrcode";
import { auth } from "@/auth";
import { locationService } from "@/src/services/location-service";
import { PrintButton } from "./print-button";

type Props = { params: Promise<{ id: string }> };

export default async function QrPrintPage({ params }: Props) {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") redirect("/login");

  const { id } = await params;

  const location = await locationService.getLocation(id, session.user.role).catch(() => notFound());

  const hdrs = await headers();
  const host = hdrs.get("host") ?? "localhost:3000";
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const submitUrl = `${proto}://${host}/submit/${location.qrToken}`;

  const svg = await QRCode.toString(submitUrl, {
    type: "svg",
    width: 280,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  });

  return (
    <div className="mx-auto max-w-sm">
      {/* Controls — hidden when printing */}
      <div className="mb-6 flex items-center gap-3 print:hidden">
        <Link
          href="/admin"
          className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          ← Back to admin
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <a
            href={`/api/locations/${location.id}/qr.png`}
            download
            className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
          >
            Download PNG
          </a>
          <PrintButton />
        </div>
      </div>

      {/* Printable card */}
      <div className="flex flex-col items-center rounded-xl border bg-white p-8 shadow-sm print:rounded-none print:border-none print:shadow-none">
        <p className="mb-1 text-center text-xs font-semibold uppercase tracking-widest text-gray-400">
          Report an issue
        </p>

        <h1 className="mb-6 text-center text-2xl font-bold text-gray-900">
          {location.name}
        </h1>

        {/* Inline SVG — crisp at any print resolution */}
        <div
          className="mb-6"
          dangerouslySetInnerHTML={{ __html: svg }}
          aria-label={`QR code for ${location.name}`}
        />

        <p className="text-center text-sm text-gray-500">
          Scan with your phone camera to submit a ticket
        </p>

        {location.address && (
          <p className="mt-3 text-center text-xs text-gray-400">{location.address}</p>
        )}

        {!location.qrActive && (
          <p className="mt-4 text-center text-xs font-medium text-red-500">
            This QR code is currently inactive.
          </p>
        )}
      </div>
    </div>
  );
}
