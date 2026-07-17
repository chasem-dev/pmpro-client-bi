/**
 * Clerk user IDs allowed to access the global admin page.
 * Safe to import from client components — these are IDs, not secrets.
 *
 * Note: this is distinct from project admins, who hold the org:admin role in
 * their Clerk organization and see all activities of their projects on the
 * My Work page.
 */
export const ADMIN_USER_IDS = [
  "user_3FdpqfvFK82ZIEi05DIWHGr09ji",
  "user_3FVDKpqY3VtC9WySQ13FiRn2gER",
];

export function isAdminUser(userId: string | null | undefined): boolean {
  return !!userId && ADMIN_USER_IDS.includes(userId);
}
