import prisma from "../lib/prisma.js";
import { hashReleaseItemContent } from "../domain/hash.js";
import { ReviewStatus } from "@prisma/client";

export async function approveStatement(id: string, statementId: string) {
  const statement = await prisma.generatedStatement.findFirst({
    where: { id: statementId, releaseId: id }
  });
  if (!statement) return null;

  if (statement.isStale) {
    const err = new Error("Cannot approve a stale statement");
    (err as any).status = 409;
    throw err;
  }

  return await prisma.generatedStatement.update({
    where: { id: statementId },
    data: { reviewStatus: ReviewStatus.APPROVED }
  });
}

export async function rejectStatement(id: string, statementId: string) {
  const statement = await prisma.generatedStatement.findFirst({
    where: { id: statementId, releaseId: id }
  });
  if (!statement) return null;

  return await prisma.generatedStatement.update({
    where: { id: statementId },
    data: { reviewStatus: ReviewStatus.REJECTED }
  });
}

export async function updateStatementContent(id: string, statementId: string, content: string) {
  const statement = await prisma.generatedStatement.findFirst({
    where: { id: statementId, releaseId: id },
    include: { evidence: { include: { releaseItem: true } } }
  });
  if (!statement) return null;

  // If approved and edited, set back to PENDING
  const nextStatus = statement.reviewStatus === ReviewStatus.APPROVED ? ReviewStatus.PENDING : statement.reviewStatus;

  // Editing a stale statement clears isStale, sets PENDING, and refreshes hashes
  const isNowStale = false;
  const finalStatus = statement.isStale ? ReviewStatus.PENDING : nextStatus;

  // Refresh hashes if it was stale
  if (statement.isStale) {
    for (const ev of statement.evidence) {
      await prisma.statementEvidence.update({
        where: { statementId_releaseItemId: { statementId, releaseItemId: ev.releaseItemId } },
        data: { sourceHashAtGeneration: ev.releaseItem.contentHash }
      });
    }
  }

  const formatDisplayId = (itemType: string, sortOrder: number) => {
    const prefix = itemType.split("_").map(w => w[0]).join("");
    return `${prefix}-${sortOrder.toString().padStart(3, "0")}`;
  };

  const currentDisplayIds = statement.evidence.map(ev => formatDisplayId(ev.releaseItem.itemType, ev.releaseItem.sortOrder));

  return await prisma.generatedStatement.update({
    where: { id: statementId },
    data: { 
      statement: content,
      reviewStatus: finalStatus,
      isStale: isNowStale,
      ...(statement.isStale ? {
        originalEvidenceCount: statement.evidence.length,
        originalEvidenceDisplayIds: currentDisplayIds
      } : {})
    }
  });
}

export async function resolveStatement(id: string, statementId: string, note: string) {
  if (!note || note.length < 5) {
    const err = new Error("Note is required and must be at least 5 characters");
    (err as any).status = 400;
    throw err;
  }

  const statement = await prisma.generatedStatement.findFirst({
    where: { id: statementId, releaseId: id },
    include: { evidence: { include: { releaseItem: true } } }
  });

  if (!statement) return null;

  if (!statement.isStale) {
    const err = new Error("Statement is not stale");
    (err as any).status = 409;
    throw err;
  }

  if (statement.evidence.length < statement.originalEvidenceCount) {
    const err = new Error("A cited item was removed. The statement must be edited or rejected.");
    (err as any).status = 409;
    throw err;
  }

  // Refresh hashes
  for (const ev of statement.evidence) {
    await prisma.statementEvidence.update({
      where: { statementId_releaseItemId: { statementId: statement.id, releaseItemId: ev.releaseItemId } },
      data: { sourceHashAtGeneration: ev.releaseItem.contentHash }
    });
  }

  return await prisma.generatedStatement.update({
    where: { id: statementId },
    data: {
      isStale: false,
      reviewStatus: ReviewStatus.PENDING,
      staleResolutionNote: note,
      staleResolvedAt: new Date()
    }
  });
}

export async function getStatementsByRelease(releaseId: string) {
  const stmts = await prisma.generatedStatement.findMany({
    where: { releaseId },
    include: {
      evidence: {
        include: { releaseItem: true }
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  const formatDisplayId = (itemType: string, sortOrder: number) => {
    const prefix = itemType.split("_").map(w => w[0]).join("");
    return `${prefix}-${sortOrder.toString().padStart(3, "0")}`;
  };

  return stmts.map(stmt => {
    const reasons: { displayId: string; reason: string }[] = [];
    if (stmt.isStale) {
      const citedDisplayIds = stmt.evidence.map(ev => formatDisplayId(ev.releaseItem.itemType, ev.releaseItem.sortOrder));
      
      for (const ev of stmt.evidence) {
        if (ev.sourceHashAtGeneration !== ev.releaseItem.contentHash) {
          const dId = formatDisplayId(ev.releaseItem.itemType, ev.releaseItem.sortOrder);
          reasons.push({ displayId: dId, reason: "CHANGED" });
        }
      }
      
      const missingIds = stmt.originalEvidenceDisplayIds.filter(id => !citedDisplayIds.includes(id));
      for (const dId of missingIds) {
        reasons.push({ displayId: dId, reason: "REMOVED" });
      }
      const totalMissing = stmt.originalEvidenceCount - stmt.evidence.length;
      const unknownCount = Math.max(0, totalMissing - missingIds.length);
      for (let i = 0; i < unknownCount; i++) {
        reasons.push({ displayId: "Unknown", reason: "REMOVED" });
      }
    }
    return {
      ...stmt,
      reasons
    };
  });
}
