import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { authErrorResponse } from "@/lib/api-utils";
import {
  listCompanyAccess,
  listFieldPolicies,
  removeCompanyAccess,
  saveCompanyAccess,
  saveFieldPolicy,
} from "@/lib/policy";
import { FIELD_KEYS, type FieldKey } from "@/lib/fields";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAppUser();
    const url = new URL(request.url);
    const scope = url.searchParams.get("scope") as "org" | "user" | null;
    const subjectKey = url.searchParams.get("subjectKey");

    if (!scope || !subjectKey || (scope !== "org" && scope !== "user")) {
      return NextResponse.json(
        { error: "scope (org|user) and subjectKey are required." },
        { status: 400 },
      );
    }

    const [policies, companies] = await Promise.all([
      listFieldPolicies(scope, subjectKey),
      listCompanyAccess(scope, subjectKey),
    ]);

    return NextResponse.json({ policies, companies });
  } catch (err) {
    return authErrorResponse(err);
  }
}

export async function PUT(request: Request) {
  try {
    await requireAppUser();
    let body: {
      scope?: "org" | "user";
      subjectKey?: string;
      fieldKey?: FieldKey;
      visible?: boolean;
      editable?: boolean;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const { scope, subjectKey, fieldKey, visible, editable } = body;
    if (!scope || !subjectKey || !fieldKey) {
      return NextResponse.json(
        { error: "scope, subjectKey, and fieldKey are required." },
        { status: 400 },
      );
    }
    if (!FIELD_KEYS.includes(fieldKey)) {
      return NextResponse.json({ error: "Invalid fieldKey." }, { status: 400 });
    }

    await saveFieldPolicy(
      scope,
      subjectKey,
      fieldKey,
      visible ?? true,
      editable ?? false,
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return authErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    await requireAppUser();
    let body: {
      scope?: "org" | "user";
      subjectKey?: string;
      epsObjectId?: string;
      epsId?: string;
      epsName?: string;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const { scope, subjectKey, epsObjectId, epsId, epsName } = body;
    if (!scope || !subjectKey || !epsObjectId || !epsId || !epsName) {
      return NextResponse.json(
        { error: "scope, subjectKey, epsObjectId, epsId, epsName are required." },
        { status: 400 },
      );
    }

    await saveCompanyAccess(scope, subjectKey, epsObjectId, epsId, epsName);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return authErrorResponse(err);
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAppUser();
    const url = new URL(request.url);
    const scope = url.searchParams.get("scope") as "org" | "user" | null;
    const subjectKey = url.searchParams.get("subjectKey");
    const epsObjectId = url.searchParams.get("epsObjectId");

    if (!scope || !subjectKey || !epsObjectId) {
      return NextResponse.json(
        { error: "scope, subjectKey, and epsObjectId are required." },
        { status: 400 },
      );
    }

    await removeCompanyAccess(scope, subjectKey, epsObjectId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return authErrorResponse(err);
  }
}
