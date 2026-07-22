import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { authErrorResponse } from "@/lib/api-utils";
import { writeAudit } from "@/lib/audit";
import { canEdit } from "@/lib/fields";
import { loadFieldPoliciesForUser } from "@/lib/policy";
import {
  createActivityComment,
  tryMarkActivitiesForUpdateReview,
} from "@/lib/p6";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/activities/[activityId]/comments">,
) {
  try {
    const user = await requireAppUser();
    const policies = await loadFieldPoliciesForUser(user);
    if (!canEdit(policies, "activityComment")) {
      return NextResponse.json(
        { error: "Activity comments are not editable for this user." },
        { status: 403 },
      );
    }

    const { activityId } = await ctx.params;
    if (!activityId || !/^\d+$/.test(activityId)) {
      return NextResponse.json({ error: "Invalid activity ObjectId." }, { status: 400 });
    }

    let body: { commentText?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const commentText = body.commentText?.trim();
    if (!commentText) {
      return NextResponse.json({ error: "commentText is required." }, { status: 400 });
    }

    // const p6User = await findUserByEmail(user.email);
    // if (!p6User) {
    //   return NextResponse.json(
    //     { error: `No P6 user found for ${user.email}.` },
    //     { status: 404 },
    //   );
    // }

    const result = await createActivityComment({
      ActivityObjectId: Number(activityId),
      CommentText: commentText,
      UserObjectId: 54,
    });

    await tryMarkActivitiesForUpdateReview([Number(activityId)]);
    await writeAudit(user, "create", "activityComment", activityId, commentText);
    return NextResponse.json({ result }, { status: 201 });
  } catch (err) {
    return authErrorResponse(err);
  }
}
