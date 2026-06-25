import { NextResponse } from "next/server";
import { getEps, P6Error } from "@/lib/p6";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const eps = await getEps();
    return NextResponse.json({ eps });
  } catch (err) {
    if (err instanceof P6Error) {
      return NextResponse.json(
        { error: err.message, details: err.body },
        { status: err.status >= 400 && err.status < 600 ? err.status : 502 },
      );
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
