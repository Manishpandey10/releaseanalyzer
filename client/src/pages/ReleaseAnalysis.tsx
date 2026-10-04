import { useEffect, useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { fetchRelease, fetchAnalysis, analyzeRelease, type Release, type AiAnalysis } from "../api";
import LifecycleStepper from "../components/LifecycleStepper";

const IMPACT_COLORS: Record<string, string> = {
  LOW: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  MEDIUM: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  HIGH: "text-red-400 bg-red-500/10 border-red-500/30",
};

const SUPPORT_COLORS: Record<string, string> = {
  SUPPORTED: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  PARTIALLY_SUPPORTED: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  UNSUPPORTED: "text-red-400 bg-red-500/10 border-red-500/30",
};

const RISK_KIND_COLORS: Record<string, string> = {
  KNOWN_LIMITATION: "text-orange-400 bg-orange-500/10 border-orange-500/30",
  INFERRED_RISK: "text-red-400 bg-red-500/10 border-red-500/30",
};

export default function ReleaseAnalysis() {
  const { id } = useParams<{ id: string }>();
  const [release, setRelease] = useState<Release | null>(null);
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalStep, setModalStep] = useState<'CONFIRM' | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([fetchRelease(id), fetchAnalysis(id)])
      .then(([rel, an]) => {
        setRelease(rel);
        setAnalysis(an);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (analysis?.status === "RUNNING") {
      interval = setInterval(async () => {
        try {
          const an = await fetchAnalysis(id!);
          if (an) {
            setAnalysis(an);
            // When analysis completes, refetch release to get fresh timestamps
            if (an.status === "COMPLETED" || an.status === "FAILED") {
              const rel = await fetchRelease(id!);
              setRelease(rel);
            }
          }
        } catch (err) {
          console.error("Poll error:", err);
        }
      }, 4000);
    }
    return () => clearInterval(interval);
  }, [analysis?.status, id]);

  const hasChanges = release?.items?.some(
    (i) => i.itemType === "FEATURE" || i.itemType === "BUG_FIX" || i.itemType === "BEHAVIOR_CHANGE"
  ) ?? false;
  
  const hasQA = release?.items?.some((i) => i.itemType === "QA_EVIDENCE") ?? false;
  const canAnalyze = hasChanges && hasQA;

  // sourcePackageChanged: derived from persisted timestamps only
  // true when any item was modified after the latest completed analysis
  const sourcePackageChanged = (() => {
    if (!analysis || analysis.status !== "COMPLETED" || !analysis.completedAt) return false;
    const completedTime = new Date(analysis.completedAt).getTime();
    
    // Only check item timestamps. Do not check release.updatedAt because 
    // the backend updates the release status to ANALYZED right after completion,
    // which makes release.updatedAt always newer than analysis.completedAt.
    if (release?.items?.some(i =>
      new Date(i.updatedAt).getTime() > completedTime ||
      new Date(i.createdAt).getTime() > completedTime
    )) return true;
    return false;
  })();

  // Lock body scroll when modal is open
  useEffect(() => {
    if (modalStep !== null) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [modalStep]);

  const handleAnalyze = async (force = false) => {
    if (!id || !canAnalyze) return;
    setAnalyzing(true);
    setError(null);
    try {
      const an = await analyzeRelease(id, force);
      setAnalysis(an);
      setModalStep(null);
      // If analysis went to RUNNING, polling will pick up completion.
      // If it returned COMPLETED immediately, refetch release for fresh timestamps.
      if (an.status === "COMPLETED") {
        const rel = await fetchRelease(id);
        setRelease(rel);
      }
    } catch (err: any) {
      if (err.message.includes("reviewed/edited work")) {
        // 409: reviewed work exists → show CONFIRM modal
        setModalStep('CONFIRM');
      } else if (err.message.includes("409")) {
        setError("Analysis is already running.");
        setModalStep(null);
      } else {
        setError(err instanceof Error ? err.message : "Analysis failed");
        setModalStep(null);
      }
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!release) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-red-400">Release not found</p>
        <Link to="/" className="text-primary-400 hover:text-primary-300 text-sm">← Back to Dashboard</Link>
      </div>
    );
  }

  if (!canAnalyze) {
    return <Navigate to={`/releases/${release.id}`} replace />;
  }

  const renderEvidenceTags = (evidenceIds?: string[]) => {
    if (!evidenceIds || !evidenceIds.length) return null;
    return evidenceIds.map((e: string) => {
      const item = release?.items?.find((i) => i.displayId === e);
      return (
        <span key={e} className="group relative inline-flex items-center text-[11px] bg-surface-800/80 text-surface-300 px-2 py-0.5 rounded border border-surface-700 hover:border-surface-600 hover:text-surface-200 transition-all cursor-default">
          <span className="font-mono font-medium">[{e}]</span>
          {item?.title && (
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[300px] px-2.5 py-1.5 bg-surface-700 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-20 shadow-xl truncate">
              {item.title}
            </span>
          )}
        </span>
      );
    });
  };

  return (
    <div className="min-h-screen pb-12">
      <header className="border-b border-surface-800 bg-surface-950/80 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to={`/releases/${release.id}`} className="text-surface-400 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-lg font-semibold text-white truncate">AI Analysis: {release.title}</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/" className="px-3 py-1.5 bg-surface-800 hover:bg-surface-700 text-surface-300 hover:text-white text-sm font-medium rounded-lg transition-colors border border-surface-700 flex items-center gap-2" title="Home">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
              <span className="hidden sm:inline">Home</span>
            </Link>
            {analysis?.status === "COMPLETED" && (
              <>
                {sourcePackageChanged && (
                  <button
                    onClick={() => handleAnalyze()}
                    disabled={analyzing || !canAnalyze}
                    className="px-4 py-1.5 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/50 text-orange-400 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    {analyzing ? "Analyzing..." : "Update Analysis"}
                  </button>
                )}
                <Link
                  to={`/releases/${release.id}/review`}
                  className="px-4 py-1.5 bg-primary-600 hover:bg-primary-500 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Review Statements
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        <LifecycleStepper releaseId={release.id} status={release.status as any} />
        
        {/* State Banner */}
        {(!analysis || analysis.status === "FAILED" || error) && (
          <div className="bg-surface-900/50 border border-surface-800 rounded-xl p-8 text-center space-y-4">
            {analysis?.status === "FAILED" || error ? (
              <div className="space-y-4">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 text-red-400 mb-2">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h2 className="text-lg font-medium text-white">AI Analysis Failed</h2>
                <p className="text-surface-400 text-sm max-w-md mx-auto">
                  AI analysis is temporarily unavailable. Your release data is still saved.
                </p>
                {(error || analysis?.error) && (
                  <p className="text-red-400 text-xs mt-2 max-w-md mx-auto break-words opacity-80">
                    {error || analysis?.error}
                  </p>
                )}
                {!hasChanges && <p className="text-amber-400 text-xs mt-3 font-medium">⚠️ Requires at least one Feature, Bug Fix, or Behavior Change.</p>}
                {!hasQA && <p className="text-amber-400 text-xs mt-1 font-medium">⚠️ Requires at least one QA Evidence item.</p>}
                <button onClick={() => handleAnalyze()} disabled={analyzing || !canAnalyze} className="mt-4 px-6 py-2.5 bg-primary-600 hover:bg-primary-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {analyzing ? "Analyzing..." : "Retry Analysis"}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary-500/10 text-primary-400 mb-2">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h2 className="text-lg font-medium text-white">Ready for AI Analysis</h2>
                <p className="text-surface-400 text-sm max-w-md mx-auto">
                  Gemini will analyze the {release.items?.length || 0} items in this release to identify impacts, risks, and missing information.
                </p>
                {!hasChanges && <p className="text-amber-400 text-xs mt-3 font-medium">⚠️ Requires at least one Feature, Bug Fix, or Behavior Change.</p>}
                {!hasQA && <p className="text-amber-400 text-xs mt-1 font-medium">⚠️ Requires at least one QA Evidence item.</p>}
                {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
                <button onClick={() => handleAnalyze()} disabled={analyzing || !canAnalyze} className="mt-4 px-6 py-2.5 bg-primary-600 hover:bg-primary-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {analyzing ? "Analyzing..." : "Analyze with AI"}
                </button>
              </div>
            )}
          </div>
        )}

        {analysis?.status === "RUNNING" && (
          <div className="bg-surface-900/50 border border-primary-500/30 rounded-xl p-12 text-center space-y-4">
            <div className="w-10 h-10 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <h2 className="text-lg font-medium text-white">Analyzing Release Package...</h2>
            <p className="text-surface-400 text-sm">Checking release impact, QA evidence, risks, and communication.</p>
          </div>
        )}

        {analysis?.status === "COMPLETED" && sourcePackageChanged && (
          <div className="bg-surface-900/50 border border-orange-500/30 rounded-xl p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-orange-500/10 text-orange-400 flex items-center justify-center text-2xl mx-auto mb-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-lg font-medium text-white">Analysis Out of Date</h2>
            <p className="text-surface-400 text-sm max-w-md mx-auto">
              Source items have been modified since this analysis was completed. The previous report may no longer reflect the current release package.
            </p>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              onClick={() => handleAnalyze()}
              disabled={analyzing || !canAnalyze}
              className="mt-4 px-6 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {analyzing && <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              {analyzing ? "Analyzing..." : "Update Analysis"}
            </button>
          </div>
        )}

        {analysis?.status === "COMPLETED" && !sourcePackageChanged && analysis.resultJson && (
          <div className="space-y-8 animate-[fadeIn_0.3s_ease-out]">
            {/* Impact Analysis */}
            <section className="space-y-4">
              <h2 className="text-lg font-medium text-white flex items-center gap-2">
                <span className="w-1.5 h-6 bg-blue-500 rounded-full"></span>
                Impact Analysis
              </h2>
              <div className="grid gap-3">
                {analysis.resultJson.impactAnalysis?.map((item: any, i: number) => (
                  <div key={i} className="bg-surface-900/40 border border-surface-800 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold border ${IMPACT_COLORS[item.impact] || IMPACT_COLORS.MEDIUM}`}>
                            {item.impact} IMPACT
                          </span>
                          <span className="text-surface-500 text-xs font-mono">[{item.itemId}]</span>
                        </div>
                        <p className="text-surface-300 text-sm leading-relaxed">{item.reason}</p>
                      </div>
                      <div className="shrink-0 flex gap-1 items-center flex-wrap">
                        {renderEvidenceTags(item.evidenceIds)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Unsupported Claims */}
            <section className="space-y-4">
              <h2 className="text-lg font-medium text-white flex items-center gap-2">
                <span className="w-1.5 h-6 bg-amber-500 rounded-full"></span>
                Unsupported & Partially Supported Claims
              </h2>
              {analysis.resultJson.unsupportedClaims?.length === 0 ? (
                <p className="text-surface-500 text-sm">No unsupported claims detected.</p>
              ) : (
                <div className="grid gap-3">
                  {analysis.resultJson.unsupportedClaims?.map((item: any, i: number) => (
                    <div key={i} className="bg-surface-900/40 border border-surface-800 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold border ${SUPPORT_COLORS[item.status] || SUPPORT_COLORS.UNSUPPORTED}`}>
                          ⚠ {item.status.replace("_", " ")}
                        </span>
                        <div className="shrink-0 flex gap-1 items-center flex-wrap">
                          {renderEvidenceTags(item.evidenceIds)}
                        </div>
                      </div>
                      <p className="text-white text-sm font-medium mb-1">Claim: {item.claim}</p>
                      <p className="text-surface-400 text-sm">Reason: {item.reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Risks */}
            <section className="space-y-4">
              <h2 className="text-lg font-medium text-white flex items-center gap-2">
                <span className="w-1.5 h-6 bg-red-500 rounded-full"></span>
                Risks
              </h2>
              {analysis.resultJson.risks?.length === 0 ? (
                <p className="text-surface-500 text-sm">No critical risks detected.</p>
              ) : (
                <div className="grid gap-3">
                  {analysis.resultJson.risks?.map((item: any, i: number) => (
                    <div key={i} className="bg-surface-900/40 border border-surface-800 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold border ${IMPACT_COLORS[item.severity] || IMPACT_COLORS.MEDIUM}`}>
                              {item.severity} SEVERITY
                            </span>
                            {item.kind && (
                              <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold border ${RISK_KIND_COLORS[item.kind] || RISK_KIND_COLORS.INFERRED_RISK}`}>
                                {item.kind === "KNOWN_LIMITATION" ? "Known Limitation" : "Inferred Risk"}
                              </span>
                            )}
                          </div>
                          <p className="text-surface-300 text-sm leading-relaxed">{item.description}</p>
                        </div>
                        <div className="shrink-0 flex gap-1 items-center flex-wrap">
                          {renderEvidenceTags(item.evidenceIds)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Internal Statements */}
            <section className="space-y-4">
              <h2 className="text-lg font-medium text-white flex items-center gap-2">
                <span className="w-1.5 h-6 bg-purple-500 rounded-full"></span>
                Internal Technical Summary
              </h2>
              <div className="space-y-2">
                {analysis.resultJson.internalStatements?.map((item: any, i: number) => {
                  const downgrade = analysis.resultJson.coverageWarnings?.find(
                    (w: any) => w.kind === "SUPPORT_DOWNGRADE" && w.statementText === item.statement
                  );
                  return (
                    <div key={i} className="p-3 bg-surface-900/20 rounded-lg hover:bg-surface-900/40 transition-colors space-y-1.5">
                      <div className="flex items-start gap-3">
                        <span className="text-surface-500 mt-0.5">•</span>
                        <p className="text-surface-200 text-sm flex-1 leading-relaxed">{item.statement}</p>
                        <div className="shrink-0 flex flex-col gap-1 items-end">
                          {item.supportStatus && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold uppercase ${SUPPORT_COLORS[item.supportStatus] || SUPPORT_COLORS.UNSUPPORTED}`}>
                              {item.supportStatus.replace("_", " ")}
                            </span>
                          )}
                          <div className="flex gap-1 items-center flex-wrap justify-end">
                            {renderEvidenceTags(item.evidenceIds)}
                          </div>
                        </div>
                      </div>
                      {downgrade && (
                        <p className="text-amber-400 text-[11px] pl-5">⚠ Unverified: {downgrade.reason}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Client Statements */}
            <section className="space-y-4">
              <h2 className="text-lg font-medium text-white flex items-center gap-2">
                <span className="w-1.5 h-6 bg-cyan-500 rounded-full"></span>
                Client / Stakeholder Summary
              </h2>
              <div className="space-y-2">
                {analysis.resultJson.clientStatements?.map((item: any, i: number) => {
                  const downgrade = analysis.resultJson.coverageWarnings?.find(
                    (w: any) => w.kind === "SUPPORT_DOWNGRADE" && w.statementText === item.statement
                  );
                  return (
                    <div key={i} className="p-3 bg-surface-900/20 rounded-lg hover:bg-surface-900/40 transition-colors space-y-1.5">
                      <div className="flex items-start gap-3">
                        <span className="text-surface-500 mt-0.5">•</span>
                        <p className="text-surface-200 text-sm flex-1 leading-relaxed">{item.statement}</p>
                        <div className="shrink-0 flex flex-col gap-1 items-end">
                          {item.supportStatus && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold uppercase ${SUPPORT_COLORS[item.supportStatus] || SUPPORT_COLORS.UNSUPPORTED}`}>
                              {item.supportStatus.replace("_", " ")}
                            </span>
                          )}
                          <div className="flex gap-1 items-center flex-wrap justify-end">
                            {renderEvidenceTags(item.evidenceIds)}
                          </div>
                        </div>
                      </div>
                      {downgrade && (
                        <p className="text-amber-400 text-[11px] pl-5">⚠ Unverified: {downgrade.reason}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Missing Info */}
            <section className="space-y-4">
              <h2 className="text-lg font-medium text-white flex items-center gap-2">
                <span className="w-1.5 h-6 bg-surface-500 rounded-full"></span>
                Missing Information
              </h2>
              {analysis.resultJson.missingInformation?.length === 0 ? (
                <p className="text-surface-500 text-sm">No missing information detected.</p>
              ) : (
                <ul className="list-disc pl-5 space-y-2">
                  {analysis.resultJson.missingInformation?.map((item: any, i: number) => (
                    <li key={i} className="text-surface-300 text-sm">
                      {item.question} <span className="text-surface-500 text-xs ml-2 uppercase">({item.severity})</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Coverage Warnings */}
            {analysis.resultJson.coverageWarnings?.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-lg font-medium text-white flex items-center gap-2">
                  <span className="w-1.5 h-6 bg-amber-600 rounded-full"></span>
                  Coverage Warnings
                </h2>
                <div className="grid gap-2">
                  {analysis.resultJson.coverageWarnings.map((w: any, i: number) => (
                    <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border text-sm ${
                      w.kind === "SUPPORT_DOWNGRADE"
                        ? "bg-amber-500/5 border-amber-500/20 text-amber-300"
                        : "bg-surface-900/40 border-surface-700 text-surface-400"
                    }`}>
                      <span className="shrink-0">{w.kind === "SUPPORT_DOWNGRADE" ? "↓" : "⚠"}</span>
                      <div>
                        {w.kind === "SUPPORT_DOWNGRADE" && (
                          <p className="font-medium text-amber-200 text-xs mb-0.5">
                            Status downgraded: {w.oldStatus} → {w.newStatus}
                          </p>
                        )}
                        <p>{w.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* Overwrite Confirmation Modal — only shown on 409 (reviewed work exists) */}
      {modalStep === 'CONFIRM' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-[fadeIn_0.3s_ease-out]">
          <div className="bg-surface-900/90 border border-red-500/30 rounded-2xl p-8 max-w-md w-full flex flex-col items-center text-center space-y-5 transform scale-100 animate-[bounceIn_0.4s_ease-out] shadow-[0_0_50px_-12px_rgba(239,68,68,0.25)] relative">
            
            {/* Spinner overlay during force re-analysis */}
            {analyzing && (
              <div className="absolute inset-0 bg-surface-900/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-2xl z-10">
                <div className="w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-red-400 font-medium animate-pulse">Running Gemini AI...</p>
              </div>
            )}

            <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center text-3xl shadow-[0_0_20px_-5px_rgba(239,68,68,0.4)]">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white tracking-tight">Overwrite Reviewed Work?</h3>
              <p className="text-surface-300 text-sm leading-relaxed">
                You have manually <span className="text-white font-medium">approved or edited</span> statements for this release. A new Gemini analysis will completely replace your reviewed work.
              </p>
            </div>
            <div className="flex gap-3 w-full mt-4 pt-2">
              <button
                onClick={() => setModalStep(null)}
                className="flex-1 py-2.5 bg-surface-800 hover:bg-surface-700 border border-surface-700 text-white rounded-xl text-sm font-semibold transition-all hover:scale-[1.02]"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAnalyze(true)}
                disabled={analyzing}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-bold transition-all shadow-[0_0_15px_-3px_rgba(239,68,68,0.4)] hover:shadow-[0_0_25px_-3px_rgba(239,68,68,0.6)] hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
              >
                Proceed & Replace
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
