"use client";

import {
  OrganizationSwitcher,
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
  useOrganization,
  useOrganizationList,
  useUser,
} from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { isAdminUser } from "@/lib/admin";

function NavLink({
  href,
  label,
  accent = false,
}: {
  href: string;
  label: string;
  /** Visually sets the link apart from regular tabs (e.g. Admin). */
  accent?: boolean;
}) {
  const pathname = usePathname();
  const active = pathname === href;
  if (accent) {
    return (
      <Link
        href={href}
        className={`ml-1 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
          active
            ? "border-amber-400 bg-amber-100 text-amber-900"
            : "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
        }`}
      >
        {label}
      </Link>
    );
  }
  return (
    <Link
      href={href}
      className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-muted text-primary"
          : "text-foreground hover:bg-muted hover:text-primary"
      }`}
    >
      {label}
    </Link>
  );
}

/**
 * Clerk's organization switcher, rendered only for users who belong to more
 * than one organization. Everyone else has nothing to switch between, and
 * their session stays on the personal account, where server-side scoping
 * (lib/auth.ts) already spans every organization they're a member of.
 */
function OrgSwitcher() {
  const { userMemberships } = useOrganizationList({
    // Only the total count matters here, so keep the payload to one record.
    userMemberships: { pageSize: 1 },
  });
  const { isLoaded, organization } = useOrganization();
  const activeOrgId = useRef<string | null | undefined>(undefined);

  // Page data is fetched client-side on mount and scoped to the active
  // organization on the server, so a reload is what actually re-scopes the
  // view after a switch.
  useEffect(() => {
    if (!isLoaded) return;
    const current = organization?.id ?? null;
    if (activeOrgId.current === undefined) {
      activeOrgId.current = current;
      return;
    }
    if (activeOrgId.current !== current) {
      activeOrgId.current = current;
      window.location.reload();
    }
  }, [isLoaded, organization?.id]);

  if ((userMemberships.count ?? 0) < 2) return null;

  return (
    <OrganizationSwitcher
      appearance={{
        elements: {
          rootBox: "flex items-center",
          organizationSwitcherTrigger:
            "h-9 rounded-md border border-brand-border px-3 text-sm font-medium text-foreground hover:bg-muted",
          // Org membership is managed in the Clerk dashboard, not by clients.
          organizationSwitcherPopoverActionButton__manageOrganization: {
            display: "none",
          },
        },
      }}
    />
  );
}

export function AppHeader() {
  const { user } = useUser();

  return (
    <header className="sticky top-0 z-50 border-b border-brand-border bg-white shadow-sm">
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="shrink-0">
            <Image
              src="/images/logo.png"
              alt="PM Pro Consulting LLC"
              width={187}
              height={61}
              priority
              className="h-12 w-auto"
            />
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            <NavLink href="/" label="Schedule Updates" />
            <NavLink href="/dashboard" label="Project Dashboard" />
            <NavLink href="/reports/units" label="Units Report" />
            {isAdminUser(user?.id) && (
              <NavLink href="/admin" label="Admin" accent />
            )}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button className="h-9 rounded-md border border-brand-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted hover:text-primary">
                Sign in
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-secondary">
                Sign up
              </button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <OrgSwitcher />
            <UserButton />
          </Show>
        </div>
      </div>
    </header>
  );
}

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-linear-to-r from-[#003366] to-[#155a9c] text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4 px-4 py-8 sm:px-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {title}
          </h1>
          {subtitle && <p className="mt-1.5 text-sm text-blue-100">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}

export function AppFooter() {
  return (
    <footer className="mt-12 bg-gray-900 text-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
        <div>
          <div className="text-sm font-semibold">PM Pro Consulting LLC</div>
          <p className="mt-1 text-xs text-gray-400">
            © {new Date().getFullYear()} PM Pro Consulting LLC. All rights
            reserved.
          </p>
        </div>
        <div className="text-xs text-gray-300">
          <a
            href="mailto:dan@pmpro.consulting"
            className="transition-colors hover:text-white"
          >
            dan@pmpro.consulting
          </a>
          <span className="mx-2 text-gray-600">|</span>
          <a href="tel:+12698956580" className="transition-colors hover:text-white">
            (269) 895-6580
          </a>
        </div>
      </div>
    </footer>
  );
}
