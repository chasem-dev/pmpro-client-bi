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
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-black">
        <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-10 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-red-100 text-xl dark:bg-red-950">
            🔒
          </div>
          <h1 className="mt-4 text-lg font-semibold text-black dark:text-zinc-50">
            Unauthorized
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            You don&apos;t have permission to view the admin area.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex h-9 items-center rounded-md bg-zinc-800 px-4 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-200 dark:text-black dark:hover:bg-zinc-300"
          >
            Back to My Work
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
