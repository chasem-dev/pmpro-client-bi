import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { isAdminUser } from "@/lib/admin";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!isAdminUser(userId)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-lg border border-brand-border bg-card p-10 text-center shadow-sm">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-red-100 text-xl">
            🔒
          </div>
          <h1 className="mt-4 text-lg font-semibold text-primary">
            Unauthorized
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            You don&apos;t have permission to view the admin area.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-secondary"
          >
            Back to My Work
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
