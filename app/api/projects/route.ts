import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createProject, getProjects, P6Error } from "@/lib/p6";

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

export async function GET() {
  try {
    const projects = await getProjects();
    return NextResponse.json({ projects });
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
