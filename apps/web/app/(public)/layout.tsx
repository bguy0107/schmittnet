/**
 * The QR-scanned ticket submission flow is "authenticated" by a per-location
 * token rather than a user login, and is meant to be used on personal phones
 * in varied lighting (break rooms, walk-ins, parking lots). It always renders
 * in dark mode, independent of the signed-in dashboard's light/dark preference.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <div className="dark min-h-screen bg-background text-foreground">{children}</div>;
}
