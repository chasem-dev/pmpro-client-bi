import { NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";
import { P6Error } from "@/lib/p6";

export function p6ErrorResponse(err: unknown) {
  if (err instanceof P6Error) {
    return NextResponse.json(
      { error: err.message, details: err.body },
      { status: err.status >= 400 && err.status < 600 ? err.status : 502 },
    );
  }
  const message = err instanceof Error ? err.message : "Unknown error";
  return NextResponse.json({ error: message }, { status: 500 });
}

export function authErrorResponse(err: unknown) {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return p6ErrorResponse(err);
}
