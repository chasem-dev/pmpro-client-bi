"use client";

import {
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
  useUser,
} from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
