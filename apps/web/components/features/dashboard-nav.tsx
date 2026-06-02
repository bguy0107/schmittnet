"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogOut, Ticket, BarChart2, Settings, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
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
    href: "/tickets",
    label: "Tickets",
    icon: <Ticket className="h-4 w-4" />,
    roles: ["SUPER_ADMIN", "TECHNICIAN", "OWNER", "OWNER_STAFF"],
  },
  {
    href: "/owner",
    label: "Dashboard",
    icon: <BarChart2 className="h-4 w-4" />,
    roles: ["SUPER_ADMIN", "OWNER", "OWNER_STAFF"],
  },
  {
    href: "/admin",
    label: "Admin",
    icon: <Settings className="h-4 w-4" />,
    roles: ["SUPER_ADMIN"],
  },
];

export function DashboardNav({ user }: DashboardNavProps) {
  const pathname = usePathname();

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(user.role));

  return (
    <nav className="border-b bg-white dark:bg-gray-900" aria-label="Main navigation">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          {/* Logo + nav links */}
          <div className="flex items-center gap-6">
            <span className="text-base font-bold text-gray-900 dark:text-gray-100">SchmittNet</span>
            <div className="hidden gap-1 sm:flex">
              {visibleItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    pathname.startsWith(item.href)
                      ? "bg-primary/10 text-primary"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100",
                  )}
                >
                  {item.icon}
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          {/* User + sign out */}
          <div className="flex items-center gap-3">
            <Link
              href={"/profile" as Route}
              className="hidden text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 sm:block"
            >
              {user.name ?? user.email}
            </Link>
            <Button variant="ghost" size="icon" asChild className="sm:hidden">
              <Link href={"/profile" as Route} aria-label="Profile">
                <User className="h-4 w-4" />
              </Link>
            </Button>
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

        {/* Mobile nav */}
        <div className="flex gap-1 pb-2 sm:hidden">
          {visibleItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                pathname.startsWith(item.href)
                  ? "bg-primary/10 text-primary"
                  : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800",
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
