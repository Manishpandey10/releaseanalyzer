import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { compareVersions, fetchRelease, type Comparison, type Release } from "../api";

const CHANGE_COLORS: Record<string, string> = {
  ADDED: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  REMOVED: "text-red-400 bg-red-500/10 border-red-500/30",
  CHANGED: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  UNCHANGED: "text-surface-400 bg-surface-800 border-surface-700",
};

export default function CompareRelease() {
  const { id, otherId } = useParams<{ id: string; otherId: string }>();
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [release, setRelease] = useState<Release | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !otherId) return;
    Promise.all([fetchRelease(id), compareVersions(id, otherId)])
      .then(([rel, comp]) => {
        setRelease(rel);
        setComparison(comp);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, otherId]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!comparison || !release) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-red-400">{error || "Comparison not found"}</p>
        <Link to="/" className="text-primary-400 hover:text-primary-300 text-sm">← Back to Dashboard</Link>
      </div>
    );
  }

  const added = comparison.differences.filter(d => d.changeCategory === "ADDED").length;
  const removed = comparison.differences.filter(d => d.changeCategory === "REMOVED").length;
  const changed = comparison.differences.filter(d => d.changeCategory === "CHANGED").length;

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
            <h1 className="text-lg font-semibold text-white truncate">Compare Versions</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-surface-400 text-sm">{comparison.baseVersion}</span>
            <svg className="w-4 h-4 text-surface-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
            <span className="text-primary-400 font-medium text-sm">{comparison.targetVersion}</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        <div className="bg-surface-900/50 border border-surface-800 rounded-xl p-6 flex gap-8">
          <div>
            <span className="text-xs text-surface-500 uppercase">Added</span>
            <p className="text-emerald-400 text-xl font-bold">{added}</p>
          </div>
          <div>
            <span className="text-xs text-surface-500 uppercase">Removed</span>
            <p className="text-red-400 text-xl font-bold">{removed}</p>
          </div>
          <div>
            <span className="text-xs text-surface-500 uppercase">Changed</span>
            <p className="text-amber-400 text-xl font-bold">{changed}</p>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-medium text-white mb-4">Item Differences</h2>
          {comparison.differences.filter(d => d.changeCategory !== "UNCHANGED").map((diff, i) => (
            <div key={i} className="bg-surface-900/50 border border-surface-800 rounded-xl overflow-hidden">
              <div className="bg-surface-800/50 px-4 py-2 flex items-center justify-between border-b border-surface-800">
                <span className="text-xs font-mono text-surface-300">[{diff.displayId}] {diff.itemType}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase border ${CHANGE_COLORS[diff.changeCategory]}`}>
                  {diff.changeCategory}
                </span>
              </div>
              <div className="grid grid-cols-2 divide-x divide-surface-800">
                <div className="p-4 bg-red-500/5">
                  <span className="text-[10px] text-surface-500 uppercase mb-2 block">{comparison.baseVersion}</span>
                  <p className="text-surface-300 text-sm whitespace-pre-wrap">{diff.oldContent || <span className="text-surface-600 italic">None</span>}</p>
                </div>
                <div className="p-4 bg-emerald-500/5">
                  <span className="text-[10px] text-surface-500 uppercase mb-2 block">{comparison.targetVersion}</span>
                  <p className="text-surface-300 text-sm whitespace-pre-wrap">{diff.newContent || <span className="text-surface-600 italic">None</span>}</p>
                </div>
              </div>
            </div>
          ))}
          {comparison.differences.filter(d => d.changeCategory !== "UNCHANGED").length === 0 && (
            <p className="text-surface-500 text-sm">No items were changed between these versions.</p>
          )}
        </div>

        {comparison.staleStatements.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-medium text-amber-400 mb-4">Stale Statements</h2>
            {comparison.staleStatements.map((stmt, i) => (
              <div key={i} className="bg-amber-500/10 border border-amber-500/30 rounded-xl overflow-hidden p-4">
                <p className="text-surface-300 text-sm mb-3">"{stmt.text}"</p>
                
                <div className="space-y-2">
                  <span className="text-xs text-amber-400 uppercase font-semibold block mb-1">Reasons for Staleness:</span>
                  {stmt.reasons.map((r, ri) => (
                    <div key={ri} className="flex items-center gap-2 text-sm bg-surface-900/50 p-2 rounded-lg border border-surface-800">
                      <span className="font-mono text-surface-300">[{r.displayId}]</span>
                      <span className="text-amber-400 font-semibold">{r.reason}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t border-amber-500/20 flex justify-between items-center">
                  <span className="text-xs text-surface-400">Review Status: <span className="text-white font-medium">{stmt.reviewStatus}</span></span>
                  <Link to={`/releases/${otherId}/review`} className="text-xs text-primary-400 hover:text-primary-300 font-medium">
                    Go to Review →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
