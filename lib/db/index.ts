import { type Collection, type Db, MongoClient } from "mongodb";
import type {
  AuditLogDoc,
  CompanyAccessDoc,
  FieldPolicyDoc,
  NonlaborEntryDoc,
  TimesheetEntryDoc,
} from "./models";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME ?? "pmpro_client_bi";

interface GlobalWithMongo {
  _mongoClient?: MongoClient;
  _mongoDb?: Db;
  _mongoIndexesReady?: Promise<void>;
}

const g = global as GlobalWithMongo;

async function ensureIndexes(db: Db): Promise<void> {
  await Promise.all([
    db
      .collection<TimesheetEntryDoc>("timesheet_entries")
      .createIndex(
        { clerkUserId: 1, resourceAssignmentObjectId: 1, workDate: 1 },
        { unique: true },
      ),
    db
      .collection<NonlaborEntryDoc>("nonlabor_entries")
      .createIndex(
        { clerkUserId: 1, resourceAssignmentObjectId: 1, workDate: 1 },
        { unique: true },
      ),
    db
      .collection<FieldPolicyDoc>("field_policies")
      .createIndex({ scope: 1, subjectKey: 1, fieldKey: 1 }, { unique: true }),
    db
      .collection<CompanyAccessDoc>("company_access")
      .createIndex({ scope: 1, subjectKey: 1, epsObjectId: 1 }, { unique: true }),
    db.collection<AuditLogDoc>("audit_logs").createIndex({ createdAt: -1 }),
    db.collection<AuditLogDoc>("audit_logs").createIndex({ clerkUserId: 1 }),
  ]);
}

export async function getDb(): Promise<Db> {
  if (!uri) {
    throw new Error("Missing required env var: MONGODB_URI");
  }
  if (!g._mongoDb) {
    const client = g._mongoClient ?? new MongoClient(uri);
    if (!g._mongoClient) {
      g._mongoClient = client;
      await client.connect();
    }
    g._mongoDb = client.db(dbName);
    g._mongoIndexesReady = ensureIndexes(g._mongoDb);
  }
  if (g._mongoIndexesReady) {
    await g._mongoIndexesReady;
  }
  return g._mongoDb;
}

export async function timesheetEntries(): Promise<Collection<TimesheetEntryDoc>> {
  return (await getDb()).collection<TimesheetEntryDoc>("timesheet_entries");
}

export async function nonlaborEntries(): Promise<Collection<NonlaborEntryDoc>> {
  return (await getDb()).collection<NonlaborEntryDoc>("nonlabor_entries");
}

export async function fieldPolicies(): Promise<Collection<FieldPolicyDoc>> {
  return (await getDb()).collection<FieldPolicyDoc>("field_policies");
}

export async function companyAccess(): Promise<Collection<CompanyAccessDoc>> {
  return (await getDb()).collection<CompanyAccessDoc>("company_access");
}

export async function auditLogs(): Promise<Collection<AuditLogDoc>> {
  return (await getDb()).collection<AuditLogDoc>("audit_logs");
}
