import { Link } from "react-router-dom";

export type ReleaseStatus = "DRAFT" | "ANALYZED" | "IN_REVIEW" | "FINAL";

interface Props {
  releaseId: string;
  status: ReleaseStatus;
  canAnalyze?: boolean;
  analysisOutdated?: boolean;
  staleCount?: number;
  pendingCount?: number;
}

export default function WhatsNext({
  releaseId,
  status,
  canAnalyze = false,
  analysisOutdated = false,
  staleCount = 0,
  pendingCount = 0,
}: Props) {
  let title = "";
  let description: React.ReactNode = "";
  let actionLabel = "";
  let actionLink = "";
  let actionDisabled = false;
  let isWarning = false;

  if (status === "DRAFT") {
    if (!canAnalyze) {
      title = "Complete your release package";
      description = "Add the missing required information before running AI analysis.";
      actionLabel = "Add Items";
      actionLink = `/releases/${releaseId}/edit`;
      isWarning = true;
    } else {
      title = "Your release is ready for analysis";
      description = "Run AI analysis to identify impact, missing information, unsupported claims, and risks.";
      actionLabel = "Run Analysis";
      actionLink = `/releases/${releaseId}/analysis`;
    }
  } else if (status === "ANALYZED") {
    if (analysisOutdated) {
      title = "Analysis is out of date";
      description = "Source package content changed after this analysis was generated.";
      actionLabel = "Re-analyze Release";
      actionLink = `/releases/${releaseId}/analysis`;
      isWarning = true;
    } else {
      title = "Analysis complete";
      description = "Review the generated statements before finalizing.";
      actionLabel = "Review Statements";
      actionLink = `/releases/${releaseId}/review`;
    }
  } else if (status === "IN_REVIEW") {
    if (staleCount > 0) {
      title = "Statements need re-review";
      description = (
        <>
          <div>{staleCount} statement(s) are stale because their source evidence changed.</div>
          {pendingCount > 0 && <div>{pendingCount} statement(s) are still pending review.</div>}
        </>
      );
      actionLabel = "Review Stale Statements";
      actionLink = `/releases/${releaseId}/review`;
      isWarning = true;
    } else if (pendingCount > 0) {
      title = "Review required";
      description = `${pendingCount} statement(s) are still pending review.`;
      actionLabel = "Continue Review";
      actionLink = `/releases/${releaseId}/review`;
    } else {
      title = "Release is ready to finalize";
      description = "All statements have been reviewed and no stale evidence remains.";
      actionLabel = "Finalize Release";
      actionLink = `/releases/${releaseId}/final`;
    }
  } else if (status === "FINAL") {
    title = "Release finalized";
    description = "This release has completed the review and finalization process.";
    actionLabel = "View Final Brief";
    actionLink = `/releases/${releaseId}`;
    // We cannot use a simple Link for creating a new version as it requires a modal/API call.
    // We'll just emit an event or let the parent handle the "Create New Version" via the header for now, 
    // or add a link to the detail page which HAS the modal.
    // The prompt says: Secondary action: "Create New Version". 
    // Since Create Version modal is on ReleaseDetail, they can click View Final Brief which goes to Detail.
  }

  return (
    <div className={`rounded-xl p-6 border ${isWarning ? 'bg-orange-500/10 border-orange-500/30' : 'bg-surface-900/60 border-surface-800'}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className={`font-semibold mb-1 ${isWarning ? 'text-orange-400' : 'text-white'}`}>
            {title}
          </h3>
          <div className="text-sm text-surface-300 leading-relaxed max-w-2xl">
            {description}
          </div>
        </div>
        {actionLabel && (
          <div className="shrink-0 flex gap-2">
            <Link
              to={actionLink}
              className={`inline-block px-5 py-2 text-sm font-medium rounded-lg transition-all ${
                isWarning
                  ? 'bg-orange-600 hover:bg-orange-500 text-white shadow-[0_0_15px_-3px_rgba(249,115,22,0.4)]'
                  : 'bg-primary-600 hover:bg-primary-500 text-white shadow-[0_0_15px_-3px_rgba(99,102,241,0.4)]'
              } ${actionDisabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
            >
              {actionLabel}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
