import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const clerk = await clerkClient();
    const { data } = await clerk.organizations.getOrganizationList({
      limit: 200,
    });
    return NextResponse.json({
      organizations: data.map((org) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
