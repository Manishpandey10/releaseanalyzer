import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchRelease, fetchStatements, fetchAnalysis, finalizeRelease, ApiError, type Release, type Statement, type AiAnalysis } from "../api";
import LifecycleStepper from "../components/LifecycleStepper";
import WhatsNext from "../components/WhatsNext";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  ANALYZED: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  IN_REVIEW: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  FINAL: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

export default function ReleaseFinal() {
  const { id } = useParams<{ id: string }>();
  const [release, setRelease] = useState<Release | null>(null);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; details?: any } | null>(null);
  const [finalizing, setFinalizing] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([fetchRelease(id), fetchStatements(id), fetchAnalysis(id)])
      .then(([rel, stmts, an]) => {
        setRelease(rel);
        setStatements(stmts);
        setAnalysis(an);
      })
      .catch((err) => setError({ message: err.message }))
      .finally(() => setLoading(false));
  }, [id]);

  const handleFinalize = async () => {
    if (!id) return;
    setFinalizing(true);
    setError(null);
    try {
      const rel = await finalizeRelease(id);
      setRelease(rel);
    } catch (err) {
      if (err instanceof ApiError) {
        setError({ message: err.message, details: err.details });
      } else {
        setError({ message: err instanceof Error ? err.message : "Failed to finalize" });
      }
    } finally {
      setFinalizing(false);
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

  // Final brief must only include APPROVED statements
  const internalStmts = statements.filter(s => s.audience === "INTERNAL" && s.reviewStatus === "APPROVED");
  const clientStmts = statements.filter(s => s.audience === "CLIENT" && s.reviewStatus === "APPROVED");

  const risks = analysis?.resultJson?.risks || [];
  const limits = release.items?.filter(i => i.itemType === "LIMITATION") || [];
  const migrations = release.items?.filter(i => i.itemType === "MIGRATION_NOTE") || [];
  const groups = release.items?.filter(i => i.itemType === "AFFECTED_GROUP") || [];
  const evidence = release.items?.filter(i => i.itemType === "QA_EVIDENCE") || [];

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
            <h1 className="text-lg font-semibold text-white truncate">Final Brief: {release.title}</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/" className="px-3 py-1.5 bg-surface-800 hover:bg-surface-700 text-surface-300 hover:text-white text-sm font-medium rounded-lg transition-colors border border-surface-700 flex items-center gap-2" title="Home">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
              <span className="hidden sm:inline">Home</span>
            </Link>
            {release.status !== "FINAL" && (
              <button
                onClick={handleFinalize}
                disabled={finalizing}
                className="px-4 py-1.5 bg-primary-600 hover:bg-primary-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {finalizing ? "Finalizing..." : "Confirm Finalize"}
              </button>
            )}
            {release.status === "FINAL" && (
              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-sm font-bold rounded-lg border border-emerald-500/30 uppercase">
                Final
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-10">
        <LifecycleStepper releaseId={release.id} status={release.status as any} />
        
        <WhatsNext 
          releaseId={release.id} 
          status={release.status as any}
          pendingCount={statements.filter(s => s.reviewStatus === "PENDING").length}
          staleCount={statements.filter(s => s.isStale).length}
        />

        {(release.parentRelease || (release.childReleases && release.childReleases.length > 0)) && (
          <div className="bg-surface-950/50 p-4 rounded-lg border border-surface-800">
            {release.parentRelease ? (
              <>
                <span className="text-xs text-surface-500 uppercase tracking-wider mb-3 block">Version Lineage</span>
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col">
                      <span className="text-surface-400 font-mono text-sm">v{release.parentRelease.version}</span>
                      <span className="text-surface-500 text-xs truncate max-w-[200px]" title={release.parentRelease.title}>{release.parentRelease.title}</span>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${STATUS_COLORS[release.parentRelease.status] || "bg-surface-800"}`}>{release.parentRelease.status.replace("_", " ")}</span>
                  </div>
                  <div className="flex items-center gap-3 text-surface-500 ml-2 py-1">
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                    <div className="flex gap-2 text-xs">
                      <Link to={`/releases/${release.parentRelease.id}`} className="text-primary-400 hover:text-primary-300 transition-colors">View Parent</Link>
                      <span>•</span>
                      <Link to={`/releases/${release.parentRelease.id}/compare/${release.id}`} className="text-primary-400 hover:text-primary-300 transition-colors">Compare with v{release.parentRelease.version}</Link>
                    </div>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col">
                      <span className="text-white font-mono text-sm font-medium">v{release.version}</span>
                      <span className="text-surface-400 text-xs truncate max-w-[200px]" title={release.title}>{release.title}</span>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${STATUS_COLORS[release.status] || "bg-surface-800"}`}>{release.status.replace("_", " ")}</span>
                  </div>
                </div>
              </>
            ) : release.childReleases && release.childReleases.length > 0 ? (
              <>
                <span className="text-xs text-surface-500 uppercase tracking-wider mb-3 block">Version History</span>
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col">
                      <span className="text-surface-400 font-mono text-sm">v{release.version}</span>
                      <span className="text-surface-500 text-xs truncate max-w-[200px]" title={release.title}>{release.title}</span>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${STATUS_COLORS[release.status] || "bg-surface-800"}`}>{release.status.replace("_", " ")}</span>
                  </div>
                  {release.childReleases.map(child => (
                    <div key={child.id}>
                      <div className="flex items-center gap-3 text-surface-500 ml-2 py-1">
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                        <div className="flex gap-2 text-xs">
                          <Link to={`/releases/${child.id}`} className="text-primary-400 hover:text-primary-300 transition-colors">View v{child.version}</Link>
                          <span>•</span>
                          <Link to={`/releases/${release.id}/compare/${child.id}`} className="text-primary-400 hover:text-primary-300 transition-colors">Compare with v{child.version}</Link>
                        </div>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex flex-col">
                          <span className="text-white font-mono text-sm font-medium">v{child.version}</span>
                          <span className="text-surface-400 text-xs truncate max-w-[200px]" title={child.title}>{child.title}</span>
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${STATUS_COLORS[child.status] || "bg-surface-800"}`}>{child.status.replace("_", " ")}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-6 rounded-xl text-sm flex flex-col gap-4">
            <div className="font-semibold text-lg text-white">Release cannot be finalized yet</div>
            {error.details && (
              <div className="space-y-2">
                {error.details.pendingCount > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-red-500 font-bold">✕</span> 
                    <span>{error.details.pendingCount} statement{error.details.pendingCount === 1 ? '' : 's'} pending review</span>
                  </div>
                )}
                {error.details.staleCount > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-red-500 font-bold">✕</span> 
                    <span>{error.details.staleCount} statement{error.details.staleCount === 1 ? ' needs' : 's need'} re-review</span>
                  </div>
                )}
                <div className="mt-4 pt-4 border-t border-red-500/20 text-red-300">
                  Review all pending and stale statements before finalizing.
                </div>
                <div className="mt-4">
                  <Link 
                    to={`/releases/${release.id}/review`}
                    className="inline-flex items-center px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg transition-colors shadow-lg shadow-red-500/20"
                  >
                    Go to Review
                  </Link>
                </div>
              </div>
            )}
            {!error.details && (
              <div>{error.message}</div>
            )}
          </div>
        )}

        {/* Client / Stakeholder Brief */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <span className="w-1.5 h-6 bg-cyan-500 rounded-full"></span>
            Client / Stakeholder Release Brief
          </h2>
          <div className="bg-surface-900/50 border border-surface-800 rounded-xl p-6">
            <ul className="list-disc pl-5 space-y-3">
              {clientStmts.length === 0 ? (
                <p className="text-surface-500 text-sm">No approved client statements.</p>
              ) : (
                clientStmts.map(s => (
                  <li key={s.id} className="text-surface-200 leading-relaxed">
                    {s.statement}
                  </li>
                ))
              )}
            </ul>
          </div>
        </section>

        {/* Internal Brief */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <span className="w-1.5 h-6 bg-purple-500 rounded-full"></span>
            Internal Release Brief
          </h2>
          <div className="bg-surface-900/50 border border-surface-800 rounded-xl p-6">
            <ul className="list-disc pl-5 space-y-3">
              {internalStmts.length === 0 ? (
                <p className="text-surface-500 text-sm">No approved internal statements.</p>
              ) : (
                internalStmts.map(s => (
                  <li key={s.id} className="text-surface-200 leading-relaxed">
                    {s.statement}
                  </li>
                ))
              )}
            </ul>
          </div>
        </section>

        {/* Risks */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <span className="w-1.5 h-6 bg-red-500 rounded-full"></span>
            Risks
          </h2>
          <div className="grid gap-3">
            {risks.length === 0 ? (
              <p className="text-surface-500 text-sm">No critical risks identified.</p>
            ) : (
              risks.map((r: any, i: number) => (
                <div key={i} className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
                  <p className="text-red-300 text-sm">{r.description} <span className="uppercase text-xs font-bold text-red-500 ml-2">({r.severity})</span></p>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Limitations */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <span className="w-1.5 h-6 bg-orange-500 rounded-full"></span>
            Known Limitations
          </h2>
          <div className="grid gap-3">
            {limits.length === 0 ? (
              <p className="text-surface-500 text-sm">No known limitations.</p>
            ) : (
              limits.map((l: any) => (
                <div key={l.id} className="bg-surface-900/50 border border-surface-800 rounded-xl p-4">
                  <span className="text-xs text-orange-400 font-mono">[{l.displayId}]</span>
                  <p className="text-surface-300 text-sm mt-1">{l.content}</p>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Migration Notes */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <span className="w-1.5 h-6 bg-purple-500 rounded-full"></span>
            Migration Notes
          </h2>
          <div className="grid gap-3">
            {migrations.length === 0 ? (
              <p className="text-surface-500 text-sm">No migration notes.</p>
            ) : (
              migrations.map((m: any) => (
                <div key={m.id} className="bg-surface-900/50 border border-surface-800 rounded-xl p-4">
                  <span className="text-xs text-purple-400 font-mono">[{m.displayId}]</span>
                  <p className="text-surface-300 text-sm mt-1">{m.content}</p>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Affected Groups */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <span className="w-1.5 h-6 bg-cyan-500 rounded-full"></span>
            Affected Groups
          </h2>
          <div className="grid gap-3">
            {groups.length === 0 ? (
              <p className="text-surface-500 text-sm">No affected groups.</p>
            ) : (
              groups.map((g: any) => (
                <div key={g.id} className="bg-surface-900/50 border border-surface-800 rounded-xl p-4">
                  <span className="text-xs text-cyan-400 font-mono">[{g.displayId}]</span>
                  <p className="text-surface-300 text-sm mt-1">{g.content}</p>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Evidence */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <span className="w-1.5 h-6 bg-blue-500 rounded-full"></span>
            Evidence
          </h2>
          <div className="grid gap-3">
            {evidence.length === 0 ? (
              <p className="text-surface-500 text-sm">No QA evidence available.</p>
            ) : (
              evidence.map((e: any) => (
                <div key={e.id} className="bg-surface-900/50 border border-surface-800 rounded-xl p-4">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs text-blue-400 font-mono">[{e.displayId}]</span>
                    <span className="text-[10px] text-surface-500 font-mono">Hash: {e.contentHash.substring(0, 12)}...</span>
                  </div>
                  <h3 className="text-sm font-medium text-white mb-1">{e.title}</h3>
                  <p className="text-surface-400 text-sm whitespace-pre-wrap">{e.content}</p>
                </div>
              ))
            )}
          </div>
        </section>

      </main>
    </div>
  );
}
