/**
 * Clerk user IDs allowed to access the admin page.
 * Safe to import from client components — these are IDs, not secrets.
 */
export const ADMIN_USER_IDS = [
  "user_3FdpqfvFK82ZIEi05DIWHGr09ji",
  "user_3FVDKpqY3VtC9WySQ13FiRn2gER",
];

export function isAdminUser(userId: string | null | undefined): boolean {
  return !!userId && ADMIN_USER_IDS.includes(userId);
}
