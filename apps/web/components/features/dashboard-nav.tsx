"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogOut, Menu, Ticket, BarChart2, Settings, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { Route } from "next";
import type { Role } from "@schmittnet/types";

interface DashboardNavProps {
  user: { name: string | null; email: string; role: Role };
}

interface NavItem {
  href: Route;
  label: string;
  icon: React.ReactNode;
  roles: Role[];
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/owner",
    label: "Dashboard",
    icon: <BarChart2 className="h-4 w-4" />,
    roles: ["SUPER_ADMIN", "OWNER", "OWNER_STAFF"],
  },
  {
    href: "/technician" as Route,
    label: "Dashboard",
    icon: <BarChart2 className="h-4 w-4" />,
    roles: ["TECHNICIAN"],
  },
  {
    href: "/tickets",
    label: "Tickets",
    icon: <Ticket className="h-4 w-4" />,
    roles: ["SUPER_ADMIN", "TECHNICIAN", "OWNER", "OWNER_STAFF"],
  },
  {
    href: "/admin",
    label: "Admin",
    icon: <Settings className="h-4 w-4" />,
    roles: ["SUPER_ADMIN"],
  },
  {
    href: "/profile" as Route,
    label: "Profile",
    icon: <User className="h-4 w-4" />,
    roles: ["SUPER_ADMIN", "TECHNICIAN", "OWNER", "OWNER_STAFF"],
  },
];

function navLinkClasses(active: boolean): string {
  return cn(
    "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
    active
      ? "bg-primary/10 text-primary"
      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100",
  );
}

export function DashboardNav({ user }: DashboardNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the sidebar whenever the route changes (e.g. after tapping a link).
  // Adjusting state during render — rather than in an effect — avoids an extra commit.
  const [renderedPathname, setRenderedPathname] = useState(pathname);
  if (pathname !== renderedPathname) {
    setRenderedPathname(pathname);
    setOpen(false);
  }

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(user.role));

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-white px-4 dark:border-gray-800 dark:bg-gray-900">
      <span className="text-base font-bold text-gray-900 dark:text-gray-100">SchmittNet</span>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Open navigation menu">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="flex w-72 max-w-[80vw] flex-col gap-0 p-0">
          <SheetHeader className="border-b px-4 py-4">
            <SheetTitle>SchmittNet</SheetTitle>
          </SheetHeader>

          <nav aria-label="Main navigation" className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
            {visibleItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={navLinkClasses(pathname.startsWith(item.href))}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center justify-between gap-2 border-t px-4 py-3">
            <span className="min-w-0 truncate text-sm text-gray-500 dark:text-gray-400">{user.name ?? user.email}</span>
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <Button
                variant="ghost"
                size="icon"
                aria-label="Sign out"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
