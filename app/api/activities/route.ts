import { NextResponse } from "next/server";
import { findActivitiesForUser, findUserByEmail, P6Error } from "@/lib/p6";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(request: Request) {
  const email = new URL(request.url).searchParams.get("email")?.trim();

  if (!email) {
    return NextResponse.json({ error: "Missing 'email' query parameter." }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Invalid email format." }, { status: 400 });
  }

  try {
    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json(
        { error: `No P6 user found for ${email}.` },
        { status: 404 },
      );
    }
    const activities = await findActivitiesForUser(user.ObjectId);
    return NextResponse.json({ user, activities });
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
