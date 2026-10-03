import prisma from "../lib/prisma.js";
import { hashReleaseItemContent } from "../domain/hash.js";
import { ReviewStatus } from "@prisma/client";

export async function approveStatement(id: string, statementId: string) {
  const statement = await prisma.generatedStatement.findFirst({
    where: { id: statementId, releaseId: id }
  });
  if (!statement) return null;

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
    where: { id: statementId, releaseId: id }
  });
  if (!statement) return null;

  // If approved and edited, set back to PENDING
  const nextStatus = statement.reviewStatus === ReviewStatus.APPROVED ? ReviewStatus.PENDING : statement.reviewStatus;

  return await prisma.generatedStatement.update({
    where: { id: statementId },
    data: { 
      statement: content,
      reviewStatus: nextStatus
    }
  });
}

export async function getStatementsByRelease(releaseId: string) {
  return await prisma.generatedStatement.findMany({
    where: { releaseId },
    include: {
      evidence: {
        include: { releaseItem: true }
      }
    },
    orderBy: { createdAt: 'asc' }
  });
}
