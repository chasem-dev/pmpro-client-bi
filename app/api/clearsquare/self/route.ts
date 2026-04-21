import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ENDPOINT =
  "https://dashboard.pmpro.consulting/api/portal/users/self/details";

export async function POST(req: Request) {
  let body: { token?: string; access_token?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const token = body.token ?? body.access_token;
  const accessToken = body.access_token ?? body.token;
  if (!token || !accessToken) {
    return NextResponse.json(
      { error: "Missing 'token' (and/or 'access_token') in body." },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, access_token: accessToken }),
    });
    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      // leave as raw text
    }
    if (!res.ok) {
      return NextResponse.json(
        { error: `Clearsquare ${res.status}`, details: parsed },
        { status: res.status },
      );
    }
    return NextResponse.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
