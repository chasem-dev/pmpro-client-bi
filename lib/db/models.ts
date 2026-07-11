import type { FieldKey } from "@/lib/fields";

export type PolicyScope = "org" | "user";

export interface TimesheetEntryDoc {
  clerkUserId: string;
  activityObjectId: number;
  resourceAssignmentObjectId: number;
  workDate: string;
  hours: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface NonlaborEntryDoc {
  clerkUserId: string;
  activityObjectId: number;
  resourceAssignmentObjectId: number;
  workDate: string;
  units: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface FieldPolicyDoc {
  scope: PolicyScope;
  subjectKey: string;
  fieldKey: FieldKey;
  visible: boolean;
  editable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompanyAccessDoc {
  scope: PolicyScope;
  subjectKey: string;
  epsObjectId: string;
  epsId: string;
  epsName: string;
  createdAt: Date;
}

export interface AuditLogDoc {
  clerkUserId: string;
  clerkEmail?: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: string;
  createdAt: Date;
}
