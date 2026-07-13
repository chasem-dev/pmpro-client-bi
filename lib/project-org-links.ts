import type { Collection } from "mongodb";
import { getDb } from "@/lib/mongo";

/**
 * Links a P6 project to the Clerk organization that owns it.
 * A project can have at most one owning organization (enforced by a
 * unique index on projectObjectId); an organization may own many projects.
 */
export interface ProjectOrgLink {
  projectObjectId: string;
  clerkOrgId: string;
  clerkOrgName: string;
  linkedByUserId: string;
  linkedAt: Date;
}

const COLLECTION = "project_org_links";

let indexEnsured: Promise<void> | null = null;

async function getCollection(): Promise<Collection<ProjectOrgLink>> {
  const db = await getDb();
  const collection = db.collection<ProjectOrgLink>(COLLECTION);
  if (!indexEnsured) {
    indexEnsured = collection
      .createIndex({ projectObjectId: 1 }, { unique: true })
      .then(() => undefined)
      .catch((err) => {
        indexEnsured = null;
        throw err;
      });
  }
  await indexEnsured;
  return collection;
}

export async function listLinks(): Promise<ProjectOrgLink[]> {
  const collection = await getCollection();
  return collection.find({}, { projection: { _id: 0 } }).toArray();
}

export async function getProjectObjectIdsForOrg(
  clerkOrgId: string,
): Promise<string[]> {
  const collection = await getCollection();
  const links = await collection
    .find({ clerkOrgId }, { projection: { _id: 0, projectObjectId: 1 } })
    .toArray();
  return links.map((link) => link.projectObjectId);
}

export class ProjectAlreadyLinkedError extends Error {
  constructor(projectObjectId: string) {
    super(
      `Project ${projectObjectId} is already linked to an organization. Unlink it first.`,
    );
    this.name = "ProjectAlreadyLinkedError";
  }
}

export async function linkProjectToOrg(link: {
  projectObjectId: string;
  clerkOrgId: string;
  clerkOrgName: string;
  linkedByUserId: string;
}): Promise<ProjectOrgLink> {
  const collection = await getCollection();
  const doc: ProjectOrgLink = { ...link, linkedAt: new Date() };
  try {
    await collection.insertOne(doc);
  } catch (err) {
    // 11000 = duplicate key: the project already has an owning organization.
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: number }).code === 11000
    ) {
      throw new ProjectAlreadyLinkedError(link.projectObjectId);
    }
    throw err;
  }
  return doc;
}

export async function unlinkProject(projectObjectId: string): Promise<boolean> {
  const collection = await getCollection();
  const result = await collection.deleteOne({ projectObjectId });
  return result.deletedCount > 0;
}
