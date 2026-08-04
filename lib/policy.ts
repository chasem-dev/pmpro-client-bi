import { companyAccess, fieldPolicies } from "@/lib/db";
import type { PolicyScope } from "@/lib/db/models";
import type { AppUser } from "@/lib/auth";
import {
  DEFAULT_FIELD_POLICIES,
  type FieldKey,
  type FieldPolicyRule,
  policyMap,
} from "@/lib/fields";

export async function loadFieldPoliciesForUser(
  user: AppUser,
): Promise<Map<FieldKey, FieldPolicyRule>> {
  const col = await fieldPolicies();
  // Sessions usually have no active organization, so match rules for every
  // organization the user belongs to.
  const queries: { scope: PolicyScope; subjectKey: string }[] = [
    { scope: "user", subjectKey: user.userId },
    ...user.orgIds.map((id) => ({ scope: "org" as const, subjectKey: id })),
  ];

  const docs = await col
    .find({ $or: queries })
    .toArray();

  const userRules: FieldPolicyRule[] = [];
  const orgRules: FieldPolicyRule[] = [];
  for (const doc of docs) {
    const rule: FieldPolicyRule = {
      fieldKey: doc.fieldKey,
      visible: doc.visible,
      editable: doc.editable,
    };
    if (doc.scope === "user") userRules.push(rule);
    else orgRules.push(rule);
  }

  const merged = policyMap(DEFAULT_FIELD_POLICIES);
  for (const rule of orgRules) merged.set(rule.fieldKey, rule);
  for (const rule of userRules) merged.set(rule.fieldKey, rule);
  return merged;
}

export async function getAllowedCompanyEpsIds(
  user: AppUser,
): Promise<Set<string> | null> {
  const col = await companyAccess();
  const queries: { scope: PolicyScope; subjectKey: string }[] = [
    { scope: "user", subjectKey: user.userId },
    ...user.orgIds.map((id) => ({ scope: "org" as const, subjectKey: id })),
  ];

  const docs = await col.find({ $or: queries }).toArray();
  if (docs.length === 0) return null;
  return new Set(docs.map((d) => d.epsObjectId));
}

export async function saveFieldPolicy(
  scope: "org" | "user",
  subjectKey: string,
  fieldKey: FieldKey,
  visible: boolean,
  editable: boolean,
): Promise<void> {
  const col = await fieldPolicies();
  const now = new Date();
  await col.updateOne(
    { scope, subjectKey, fieldKey },
    {
      $set: { visible, editable, updatedAt: now },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );
}

export async function saveCompanyAccess(
  scope: "org" | "user",
  subjectKey: string,
  epsObjectId: string,
  epsId: string,
  epsName: string,
): Promise<void> {
  const col = await companyAccess();
  await col.updateOne(
    { scope, subjectKey, epsObjectId },
    {
      $set: { epsId, epsName },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true },
  );
}

export async function removeCompanyAccess(
  scope: "org" | "user",
  subjectKey: string,
  epsObjectId: string,
): Promise<void> {
  const col = await companyAccess();
  await col.deleteOne({ scope, subjectKey, epsObjectId });
}

export async function listFieldPolicies(
  scope: "org" | "user",
  subjectKey: string,
): Promise<FieldPolicyRule[]> {
  const col = await fieldPolicies();
  const docs = await col.find({ scope, subjectKey }).toArray();
  const map = policyMap(DEFAULT_FIELD_POLICIES);
  for (const doc of docs) {
    map.set(doc.fieldKey, {
      fieldKey: doc.fieldKey,
      visible: doc.visible,
      editable: doc.editable,
    });
  }
  return Array.from(map.values());
}

export async function listCompanyAccess(
  scope: "org" | "user",
  subjectKey: string,
) {
  const col = await companyAccess();
  return col.find({ scope, subjectKey }).toArray();
}
