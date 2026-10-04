import prisma from "../lib/prisma.js";
import { hashReleaseItemContent } from "../domain/hash.js";
import { formatDisplayId } from "../domain/displayId.js";
import type { CreateReleaseInput, UpdateReleaseInput } from "../validation/release.js";
import type { ReleaseItemType } from "@prisma/client";

const RELEASE_INCLUDE = {
  items: {
    orderBy: { sortOrder: "asc" as const },
  },
} as const;

/**
 * Enriches release items with human-readable display IDs.
 */
function addDisplayIds<T extends { itemType: ReleaseItemType; sortOrder: number }>(
  items: T[]
): (T & { displayId: string })[] {
  return items.map((item) => ({
    ...item,
    displayId: formatDisplayId(item.itemType, item.sortOrder),
  }));
}

export async function createRelease(input: CreateReleaseInput) {
  // Calculate sort orders per item type
  const typeCounts: Partial<Record<ReleaseItemType, number>> = {};
  const itemsWithHash = input.items.map((item, index) => {
    const typeKey = item.itemType as ReleaseItemType;
    typeCounts[typeKey] = (typeCounts[typeKey] || 0) + 1;
    const sortOrder = item.sortOrder ?? typeCounts[typeKey]!;

    return {
      itemType: item.itemType,
      title: item.title,
      content: item.content,
      sortOrder,
      contentHash: hashReleaseItemContent(item),
    };
  });

  const existing = await prisma.release.findFirst({
    where: { title: input.title, version: input.version },
  });
  if (existing) {
    const err = new Error("A release with this title and version already exists");
    (err as any).status = 409;
    throw err;
  }

  let release;
  try {
    release = await prisma.release.create({
      data: {
        version: input.version,
        title: input.title,
        parentReleaseId: input.parentReleaseId ?? null,
        items: {
          create: itemsWithHash,
        },
      },
      include: RELEASE_INCLUDE,
    });
  } catch (err: any) {
    if (err.code === "P2002") {
      const e = new Error("A release with this title and version already exists");
      (e as any).status = 409;
      throw e;
    }
    throw err;
  }

  return {
    ...release,
    items: addDisplayIds(release.items),
  };
}

export async function getAllReleases() {
  const releases = await prisma.release.findMany({
    include: {
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return releases;
}

export async function getReleaseById(id: string) {
  const release = await prisma.release.findUnique({
    where: { id },
    include: RELEASE_INCLUDE,
  });

  if (!release) return null;

  return {
    ...release,
    items: addDisplayIds(release.items),
  };
}

export async function updateRelease(id: string, input: UpdateReleaseInput) {
  // Check existence
  const existing = await prisma.release.findUnique({ where: { id } });
  if (!existing) return null;

  // Build the update — handle items replacement if provided
  const release = await prisma.$transaction(async (tx) => {
    // Update release metadata
    const updateData: Record<string, unknown> = {};
    if (input.version !== undefined) updateData.version = input.version;
    if (input.title !== undefined) updateData.title = input.title;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.parentReleaseId !== undefined) updateData.parentReleaseId = input.parentReleaseId;

    await tx.release.update({
      where: { id },
      data: updateData,
    });

    // If items are provided, replace all items
    if (input.items !== undefined) {
      const oldItems = await tx.releaseItem.findMany({ where: { releaseId: id } });
      const oldItemMap = new Map(oldItems.map(i => [`${i.itemType}-${i.sortOrder}`, i]));

      const typeCounts: Partial<Record<ReleaseItemType, number>> = {};
      const newIdsToKeep = new Set<string>();

      for (const item of input.items) {
        const typeKey = item.itemType as ReleaseItemType;
        typeCounts[typeKey] = (typeCounts[typeKey] || 0) + 1;
        const sortOrder = item.sortOrder ?? typeCounts[typeKey]!;
        const key = `${typeKey}-${sortOrder}`;
        const contentHash = hashReleaseItemContent(item);
        
        const existing = oldItemMap.get(key);
        if (existing) {
          await tx.releaseItem.update({
            where: { id: existing.id },
            data: { title: item.title, content: item.content, contentHash }
          });
          newIdsToKeep.add(existing.id);

          if (existing.contentHash !== contentHash) {
             const evs = await tx.statementEvidence.findMany({ where: { releaseItemId: existing.id } });
             for (const ev of evs) {
               await tx.generatedStatement.update({ where: { id: ev.statementId }, data: { isStale: true } });
             }
          }
        } else {
          const created = await tx.releaseItem.create({
            data: { releaseId: id, itemType: item.itemType as ReleaseItemType, title: item.title, content: item.content, sortOrder, contentHash }
          });
          newIdsToKeep.add(created.id);
        }
      }

      const toDelete = oldItems.filter(i => !newIdsToKeep.has(i.id)).map(i => i.id);
      if (toDelete.length > 0) {
        const evs = await tx.statementEvidence.findMany({ where: { releaseItemId: { in: toDelete } } });
        const stmtIds = [...new Set(evs.map(e => e.statementId))];
        if (stmtIds.length > 0) {
          await tx.generatedStatement.updateMany({
            where: { id: { in: stmtIds } },
            data: { isStale: true }
          });
        }
        await tx.statementEvidence.deleteMany({ where: { releaseItemId: { in: toDelete } } });
        await tx.releaseItem.deleteMany({ where: { id: { in: toDelete } } });
      }
    }

    return tx.release.findUnique({
      where: { id },
      include: RELEASE_INCLUDE,
    });
  }, { maxWait: 10000, timeout: 30000 });

  if (!release) return null;

  return {
    ...release,
    items: addDisplayIds(release.items),
  };
}

export async function finalizeRelease(id: string) {
  const release = await prisma.release.findUnique({
    where: { id },
    include: {
      statements: true,
      aiAnalyses: { orderBy: { createdAt: "desc" }, take: 1 }
    }
  });

  if (!release) throw new Error("Release not found");
  if (release.status === "FINAL") throw new Error("Release is already final");

  if (release.statements.length === 0) {
    throw new Error("Cannot finalize without reviewed AI statements.");
  }

  const pendingStatements = release.statements.filter(s => s.reviewStatus === "PENDING");
  const staleStatements = release.statements.filter(s => s.isStale);

  if (pendingStatements.length > 0 || staleStatements.length > 0) {
    const err = new Error("Cannot finalize release.");
    (err as any).status = 400;
    (err as any).details = {
      pendingCount: pendingStatements.length,
      staleCount: staleStatements.length,
      pendingStatementIds: pendingStatements.map(s => s.id),
      staleStatementIds: staleStatements.map(s => s.id),
    };
    throw err;
  }

  const finalized = await prisma.release.update({
    where: { id },
    data: { status: "FINAL" },
    include: RELEASE_INCLUDE
  });

  return {
    ...finalized,
    items: addDisplayIds(finalized.items)
  };
}

export async function createVersion(originalId: string, newVersionStr: string) {
  const original = await prisma.release.findUnique({
    where: { id: originalId },
    include: { items: true, statements: { include: { evidence: true } } }
  });

  if (!original) throw new Error("Original release not found");

  return await prisma.$transaction(async (tx) => {
    // Create new release
    const newRelease = await tx.release.create({
      data: {
        version: newVersionStr,
        title: original.title,
        status: "DRAFT",
        parentReleaseId: original.id,
      }
    });

    // Map of old itemId -> new itemId
    const itemMap = new Map<string, string>();

    // Copy items exactly, preserving sortOrder
    for (const item of original.items) {
      const newItem = await tx.releaseItem.create({
        data: {
          releaseId: newRelease.id,
          itemType: item.itemType,
          title: item.title,
          content: item.content,
          sortOrder: item.sortOrder,
          contentHash: item.contentHash,
        }
      });
      itemMap.set(item.id, newItem.id);
    }

    // Copy statements
    for (const stmt of original.statements) {
      const newStmt = await tx.generatedStatement.create({
        data: {
          releaseId: newRelease.id,
          audience: stmt.audience,
          statement: stmt.statement,
          impact: stmt.impact,
          supportStatus: stmt.supportStatus,
          reviewStatus: stmt.reviewStatus, // keep review status since content hasn't changed yet
          isStale: stmt.isStale,
          isEdited: stmt.isEdited,
          originalEvidenceCount: stmt.originalEvidenceCount,
          originalEvidenceDisplayIds: stmt.originalEvidenceDisplayIds,
        }
      });

      // Link evidence using new item IDs
      for (const ev of stmt.evidence) {
        const newItemId = itemMap.get(ev.releaseItemId);
        if (newItemId) {
          await tx.statementEvidence.create({
            data: {
              statementId: newStmt.id,
              releaseItemId: newItemId,
              sourceHashAtGeneration: ev.sourceHashAtGeneration
            }
          });
        }
      }
    }

    const fullNew = await tx.release.findUnique({
      where: { id: newRelease.id },
      include: RELEASE_INCLUDE
    });

    return {
      ...fullNew!,
      items: addDisplayIds(fullNew!.items)
    };
  }, { maxWait: 10000, timeout: 30000 });
}

export async function compareVersions(id1: string, id2: string) {
  const [rel1, rel2] = await Promise.all([
    getReleaseById(id1),
    getReleaseById(id2)
  ]);

  if (!rel1 || !rel2) throw new Error("One or both releases not found");

  const map1 = new Map(rel1.items.map(i => [i.displayId, i]));
  const map2 = new Map(rel2.items.map(i => [i.displayId, i]));

  const allIds = Array.from(new Set([...map1.keys(), ...map2.keys()]));

  const differences = allIds.map(displayId => {
    const i1 = map1.get(displayId);
    const i2 = map2.get(displayId);

    if (i1 && !i2) {
      return { displayId, itemType: i1.itemType, changeCategory: "REMOVED", oldContent: i1.content, newContent: null };
    } else if (!i1 && i2) {
      return { displayId, itemType: i2.itemType, changeCategory: "ADDED", oldContent: null, newContent: i2.content };
    } else if (i1 && i2) {
      if (i1.contentHash !== i2.contentHash) {
        return { displayId, itemType: i1.itemType, changeCategory: "CHANGED", oldContent: i1.content, newContent: i2.content };
      }
      return { displayId, itemType: i1.itemType, changeCategory: "UNCHANGED", oldContent: i1.content, newContent: i2.content };
    }
    return null; // shouldn't happen
  }).filter(Boolean);

  const targetStatements = await prisma.generatedStatement.findMany({
    where: { releaseId: id2, isStale: true },
    include: { evidence: { include: { releaseItem: true } } }
  });

  const baseStatements = await prisma.generatedStatement.findMany({
    where: { releaseId: id1 },
    include: { evidence: { include: { releaseItem: true } } }
  });

  const staleStatements = targetStatements.map(stmt => {
    const citedDisplayIds = stmt.originalEvidenceDisplayIds || [];
    const reasons: { displayId: string; reason: string }[] = [];

    // Determine current valid display IDs from evidence links
    const currentEvDisplayIds = new Set<string>();
    
    for (const ev of stmt.evidence) {
      const dId = formatDisplayId(ev.releaseItem.itemType, ev.releaseItem.sortOrder);
      currentEvDisplayIds.add(dId);

      // CHANGED: the item is still linked, but its hash differs from generation time
      if (ev.sourceHashAtGeneration !== ev.releaseItem.contentHash) {
        reasons.push({ displayId: dId, reason: "CHANGED" });
      }
    }

    // REMOVED: it was in originalEvidenceDisplayIds, but is no longer in current evidence links
    for (const dId of citedDisplayIds) {
      if (!currentEvDisplayIds.has(dId)) {
        reasons.push({ displayId: dId, reason: "REMOVED" });
      }
    }

    // Fallback if there was a length mismatch not covered by the display IDs array (e.g. old data)
    const unknownCount = Math.max(0, stmt.originalEvidenceCount - (currentEvDisplayIds.size + reasons.filter(r => r.reason === "REMOVED").length));
    for (let i = 0; i < unknownCount; i++) {
      reasons.push({ displayId: "Unknown", reason: "REMOVED" });
    }

    return {
      id: stmt.id,
      text: stmt.statement,
      reviewStatus: stmt.reviewStatus,
      citedDisplayIds,
      reasons
    };
  });

  return {
    baseVersion: rel1.version,
    targetVersion: rel2.version,
    differences,
    staleStatements
  };
}
