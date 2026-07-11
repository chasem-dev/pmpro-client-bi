import type { P6Eps, P6Project } from "./p6";

export interface EpsNode extends P6Eps {
  ParentObjectId?: string;
}

export interface EpsTreeNode extends P6Eps {
  ParentObjectId?: string;
  children: EpsTreeNode[];
  depth: number;
}

const PROD_EPS_ID = process.env.P6_PROD_EPS_ID ?? "PROD";

export function buildEpsTree(epsList: EpsNode[]): EpsTreeNode[] {
  const byId = new Map<string, EpsTreeNode>();
  for (const eps of epsList) {
    byId.set(eps.ObjectId, { ...eps, children: [], depth: 0 });
  }

  const roots: EpsTreeNode[] = [];
  for (const node of byId.values()) {
    const parentId = node.ParentObjectId;
    if (parentId && byId.has(parentId)) {
      const parent = byId.get(parentId)!;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  function setDepth(node: EpsTreeNode, depth: number) {
    node.depth = depth;
    for (const child of node.children) {
      setDepth(child, depth + 1);
    }
  }
  for (const root of roots) setDepth(root, 0);

  return roots;
}

export function findEpsById(
  epsList: EpsNode[],
  id: string,
): EpsNode | undefined {
  return epsList.find((e) => e.Id === id || e.ObjectId === id);
}

export function getProdEpsObjectId(epsList: EpsNode[]): string | null {
  const prod = findEpsById(epsList, PROD_EPS_ID);
  return prod?.ObjectId ?? null;
}

export function getDescendantEpsIds(
  epsList: EpsNode[],
  rootObjectId: string,
): Set<string> {
  const childrenByParent = new Map<string, string[]>();
  for (const eps of epsList) {
    if (eps.ParentObjectId) {
      const list = childrenByParent.get(eps.ParentObjectId) ?? [];
      list.push(eps.ObjectId);
      childrenByParent.set(eps.ParentObjectId, list);
    }
  }

  const result = new Set<string>();
  const queue = [rootObjectId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    result.add(id);
    const children = childrenByParent.get(id) ?? [];
    queue.push(...children);
  }
  return result;
}

export function getSecondLevelCompanyEps(
  epsList: EpsNode[],
  prodObjectId: string,
): EpsNode[] {
  return epsList.filter((e) => e.ParentObjectId === prodObjectId);
}

export function resolveCompanyEpsForProject(
  epsList: EpsNode[],
  project: P6Project & { ParentEPSObjectId?: string },
  prodObjectId: string,
): EpsNode | null {
  const byId = new Map(epsList.map((e) => [e.ObjectId, e]));
  let current = project.ParentEPSObjectId
    ? byId.get(project.ParentEPSObjectId)
    : undefined;

  while (current) {
    if (current.ParentObjectId === prodObjectId) {
      return current;
    }
    current = current.ParentObjectId
      ? byId.get(current.ParentObjectId)
      : undefined;
  }
  return null;
}

export function filterProjectsInProd(
  projects: (P6Project & { ParentEPSObjectId?: string })[],
  epsList: EpsNode[],
): (P6Project & { ParentEPSObjectId?: string; companyEps?: EpsNode | null })[] {
  const prodId = getProdEpsObjectId(epsList);
  if (!prodId) return [];

  const prodDescendants = getDescendantEpsIds(epsList, prodId);
  return projects
    .filter(
      (p) =>
        p.ParentEPSObjectId && prodDescendants.has(p.ParentEPSObjectId),
    )
    .map((p) => ({
      ...p,
      companyEps: resolveCompanyEpsForProject(epsList, p, prodId),
    }));
}
