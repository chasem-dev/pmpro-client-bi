export const FIELD_KEYS = [
  "project",
  "activityId",
  "activityName",
  "percentComplete",
  "plannedStart",
  "plannedFinish",
  "totalFloat",
  "freeFloat",
  "actualStart",
  "actualFinish",
  "expectedFinish",
  "activityComment",
  "activityStep",
  "resourceName",
  "budgetedLaborUnits",
  "atCompleteLaborUnits",
  "actualLaborUnits",
  "remainingLaborUnits",
  "budgetedNonLaborUnits",
  "atCompleteNonLaborUnits",
  "actualNonLaborUnits",
  "remainingNonLaborUnits",
  "materialName",
  "budgetedMaterialCost",
  "actualMaterialCost",
] as const;

export type FieldKey = (typeof FIELD_KEYS)[number];

export interface FieldPolicyRule {
  fieldKey: FieldKey;
  visible: boolean;
  editable: boolean;
}

export const DEFAULT_FIELD_POLICIES: FieldPolicyRule[] = [
  { fieldKey: "project", visible: true, editable: false },
  { fieldKey: "activityId", visible: true, editable: false },
  { fieldKey: "activityName", visible: true, editable: false },
  { fieldKey: "percentComplete", visible: true, editable: true },
  { fieldKey: "plannedStart", visible: true, editable: false },
  { fieldKey: "plannedFinish", visible: true, editable: false },
  { fieldKey: "totalFloat", visible: true, editable: false },
  { fieldKey: "freeFloat", visible: true, editable: false },
  { fieldKey: "actualStart", visible: true, editable: true },
  { fieldKey: "actualFinish", visible: true, editable: true },
  { fieldKey: "expectedFinish", visible: true, editable: true },
  { fieldKey: "activityComment", visible: true, editable: true },
  { fieldKey: "activityStep", visible: true, editable: true },
  { fieldKey: "resourceName", visible: true, editable: false },
  { fieldKey: "budgetedLaborUnits", visible: true, editable: false },
  { fieldKey: "atCompleteLaborUnits", visible: true, editable: true },
  { fieldKey: "actualLaborUnits", visible: true, editable: true },
  { fieldKey: "remainingLaborUnits", visible: true, editable: true },
  { fieldKey: "budgetedNonLaborUnits", visible: true, editable: false },
  { fieldKey: "atCompleteNonLaborUnits", visible: true, editable: true },
  { fieldKey: "actualNonLaborUnits", visible: true, editable: true },
  { fieldKey: "remainingNonLaborUnits", visible: true, editable: true },
  { fieldKey: "materialName", visible: true, editable: false },
  { fieldKey: "budgetedMaterialCost", visible: true, editable: false },
  { fieldKey: "actualMaterialCost", visible: true, editable: true },
];

export function policyMap(
  rules: FieldPolicyRule[],
): Map<FieldKey, FieldPolicyRule> {
  const map = new Map<FieldKey, FieldPolicyRule>();
  for (const rule of DEFAULT_FIELD_POLICIES) {
    map.set(rule.fieldKey, { ...rule });
  }
  for (const rule of rules) {
    map.set(rule.fieldKey, rule);
  }
  return map;
}

export function canView(
  policies: Map<FieldKey, FieldPolicyRule>,
  key: FieldKey,
): boolean {
  return policies.get(key)?.visible ?? true;
}

export function canEdit(
  policies: Map<FieldKey, FieldPolicyRule>,
  key: FieldKey,
): boolean {
  const rule = policies.get(key);
  return (rule?.visible ?? true) && (rule?.editable ?? false);
}
