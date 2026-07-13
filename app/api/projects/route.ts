import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { createProject, getEps, getProjects, P6Error } from "@/lib/p6";
import { getProjectObjectIdsForOrg } from "@/lib/project-org-links";

export const dynamic = "force-dynamic";

function p6ErrorResponse(err: unknown) {
  if (err instanceof P6Error) {
    return NextResponse.json(
      { error: err.message, details: err.body },
      { status: err.status >= 400 && err.status < 600 ? err.status : 502 },
    );
  }
  const message = err instanceof Error ? err.message : "Unknown error";
  return NextResponse.json({ error: message }, { status: 500 });
}

// Every organization the user belongs to, preferring the active one.
async function getUserOrgIds(): Promise<string[]> {
  const { userId, orgId } = await auth();
  if (orgId) return [orgId];
  if (!userId) return [];
  const clerk = await clerkClient();
  const memberships = await clerk.users.getOrganizationMembershipList({
    userId,
    limit: 100,
  });
  return memberships.data.map((m) => m.organization.id);
}

export async function GET(req: NextRequest) {
  const scope = req.nextUrl.searchParams.get("scope");

  try {
    // Admin views pass ?scope=all to see every P6 project.
    if (scope === "all") {
      const projects = await getProjects();
      return NextResponse.json({ projects });
    }

    const orgIds = await getUserOrgIds();
    if (orgIds.length === 0) {
      return NextResponse.json({ projects: [] });
    }

    const linkedIdLists = await Promise.all(
      orgIds.map((id) => getProjectObjectIdsForOrg(id)),
    );
    const allowed = new Set(linkedIdLists.flat());
    if (allowed.size === 0) {
      return NextResponse.json({ projects: [] });
    }

    const projects = await getProjects();
    return NextResponse.json({
      projects: projects.filter((p) => allowed.has(String(p.ObjectId))),
    });
  } catch (err) {
    return p6ErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { Id, Name, ParentEPSObjectId, Description } = (body ?? {}) as Record<
    string,
    unknown
  >;

  if (typeof Id !== "string" || !Id.trim()) {
    return NextResponse.json({ error: "Project Id is required." }, { status: 400 });
  }
  if (typeof Name !== "string" || !Name.trim()) {
    return NextResponse.json({ error: "Project Name is required." }, { status: 400 });
  }
  const epsId = Number(ParentEPSObjectId);
  if (!Number.isInteger(epsId)) {
    return NextResponse.json(
      { error: "A valid ParentEPSObjectId (business/EPS) is required." },
      { status: 400 },
    );
  }

  try {
    // Projects may only be created inside the Production EPS branch.
    const productionEps = await getEps();
    if (!productionEps.some((node) => Number(node.ObjectId) === epsId)) {
      return NextResponse.json(
        { error: "Projects can only be created inside the Production EPS." },
        { status: 400 },
      );
    }

    const result = await createProject({
      Id: Id.trim(),
      Name: Name.trim(),
      ParentEPSObjectId: epsId,
      ...(typeof Description === "string" && Description.trim()
        ? { Description: Description.trim() }
        : {}),
    });
    return NextResponse.json({ result }, { status: 201 });
  } catch (err) {
    return p6ErrorResponse(err);
  }
}
