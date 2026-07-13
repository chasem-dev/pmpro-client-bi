import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import {
  linkProjectToOrg,
  listLinks,
  ProjectAlreadyLinkedError,
  unlinkProject,
} from "@/lib/project-org-links";

export const dynamic = "force-dynamic";

function errorResponse(err: unknown) {
  const message = err instanceof Error ? err.message : "Unknown error";
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET() {
  try {
    const links = await listLinks();
    return NextResponse.json({ links });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { projectObjectId, clerkOrgId } = (body ?? {}) as Record<
    string,
    unknown
  >;

  if (typeof projectObjectId !== "string" || !projectObjectId.trim()) {
    return NextResponse.json(
      { error: "projectObjectId is required." },
      { status: 400 },
    );
  }
  if (typeof clerkOrgId !== "string" || !clerkOrgId.trim()) {
    return NextResponse.json(
      { error: "clerkOrgId is required." },
      { status: 400 },
    );
  }

  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }

    // Resolve the org through Clerk so we never store a bogus org id.
    const clerk = await clerkClient();
    const org = await clerk.organizations.getOrganization({
      organizationId: clerkOrgId.trim(),
    });

    const link = await linkProjectToOrg({
      projectObjectId: projectObjectId.trim(),
      clerkOrgId: org.id,
      clerkOrgName: org.name,
      linkedByUserId: userId,
    });
    return NextResponse.json({ link }, { status: 201 });
  } catch (err) {
    if (err instanceof ProjectAlreadyLinkedError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return errorResponse(err);
  }
}

export async function DELETE(req: NextRequest) {
  const projectObjectId = req.nextUrl.searchParams.get("projectObjectId");
  if (!projectObjectId) {
    return NextResponse.json(
      { error: "projectObjectId query param is required." },
      { status: 400 },
    );
  }

  try {
    const removed = await unlinkProject(projectObjectId);
    if (!removed) {
      return NextResponse.json(
        { error: "No link found for this project." },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
