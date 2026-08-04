import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { requireAppUser } from "@/lib/auth";
import { authErrorResponse } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

/**
 * Members of a Clerk organization, used to assign activity owners.
 * Global admins may list any organization; org admins only their own.
 */
export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/organizations/[orgId]/members">,
) {
  try {
    const user = await requireAppUser();
    const { orgId } = await ctx.params;

    const allowed = user.isGlobalAdmin || user.adminOrgIds.includes(orgId);
    if (!allowed) {
      return NextResponse.json(
        { error: "You are not allowed to list this organization's members." },
        { status: 403 },
      );
    }

    const clerk = await clerkClient();
    const { data } = await clerk.organizations.getOrganizationMembershipList({
      organizationId: orgId,
      limit: 200,
    });

    const members = data
      .map((m) => ({
        userId: m.publicUserData?.userId ?? "",
        name: [m.publicUserData?.firstName, m.publicUserData?.lastName]
          .filter(Boolean)
          .join(" "),
        email: m.publicUserData?.identifier ?? "",
        role: m.role,
      }))
      .filter((m) => m.email);

    return NextResponse.json({ members });
  } catch (err) {
    return authErrorResponse(err);
  }
}
