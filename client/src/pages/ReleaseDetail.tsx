import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import type { Release } from "../api";
import { fetchRelease } from "../api";

const TYPE_COLORS: Record<string, string> = {
  FEATURE: "bg-emerald-500/20 text-emerald-400",
  BUG_FIX: "bg-red-500/20 text-red-400",
  BEHAVIOR_CHANGE: "bg-amber-500/20 text-amber-400",
  QA_EVIDENCE: "bg-blue-500/20 text-blue-400",
  LIMITATION: "bg-orange-500/20 text-orange-400",
  MIGRATION_NOTE: "bg-purple-500/20 text-purple-400",
  AFFECTED_GROUP: "bg-cyan-500/20 text-cyan-400",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  ANALYZED: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  IN_REVIEW: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  FINAL: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

export default function ReleaseDetail() {
  const { id } = useParams<{ id: string }>();
  const [release, setRelease] = useState<Release | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchRelease(id)
      .then(setRelease)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !release) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-red-400">{error || "Release not found"}</p>
        <Link to="/" className="text-primary-400 hover:text-primary-300 text-sm">← Back to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-surface-800 bg-surface-950/80 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-surface-400 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-lg font-semibold text-white truncate">{release.title}</h1>
          </div>
          <div className="flex gap-2">
            {release.status !== "FINAL" && (
              <Link
                to={`/releases/${release.id}/edit`}
                className="px-4 py-1.5 bg-surface-800 hover:bg-surface-700 text-white text-sm font-medium rounded-lg transition-colors border border-surface-700"
              >
                Edit Release
              </Link>
            )}
            {release.status === "FINAL" && (
              <button
                onClick={async () => {
                  const newVer = prompt("Enter new version number (e.g. 1.1.0)");
                  if (newVer) {
                    const { createVersion } = await import("../api");
                    createVersion(release.id, newVer).then(res => window.location.href = `/releases/${res.id}`).catch(err => alert(err.message));
                  }
                }}
                className="px-4 py-1.5 bg-surface-800 hover:bg-surface-700 text-white text-sm font-medium rounded-lg transition-colors border border-surface-700"
              >
                Create New Version
              </button>
            )}
            {(() => {
              const hasChanges = release.items?.some(
                (i) => i.itemType === "FEATURE" || i.itemType === "BUG_FIX" || i.itemType === "BEHAVIOR_CHANGE"
              ) ?? false;
              const hasQA = release.items?.some((i) => i.itemType === "QA_EVIDENCE") ?? false;
              const canAnalyze = hasChanges && hasQA;

              if (!canAnalyze) {
                return (
                  <button
                    disabled
                    title="Requires at least 1 change item (Feature, Bug Fix, etc.) and 1 QA Evidence item"
                    className="px-4 py-1.5 bg-primary-600/50 text-white/50 text-sm font-medium rounded-lg border border-primary-500/20 cursor-not-allowed"
                  >
                    Analyze with AI
                  </button>
                );
              }

              return (
                <Link
                  to={`/releases/${release.id}/analysis`}
                  className="px-4 py-1.5 bg-primary-600 hover:bg-primary-500 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Analyze with AI
                </Link>
              );
            })()}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Metadata */}
        <div className="bg-surface-900/50 border border-surface-800 rounded-xl p-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <span className="text-xs text-surface-500 uppercase tracking-wider">Version</span>
              <p className="text-white font-mono mt-1">{release.version}</p>
            </div>
            <div>
              <span className="text-xs text-surface-500 uppercase tracking-wider">Status</span>
              <p className="mt-1">
                <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[release.status] || ""}`}>
                  {release.status.replace("_", " ")}
                </span>
              </p>
            </div>
            <div>
              <span className="text-xs text-surface-500 uppercase tracking-wider">Created</span>
              <p className="text-surface-300 text-sm mt-1">{new Date(release.createdAt).toLocaleString()}</p>
            </div>
            <div>
              <span className="text-xs text-surface-500 uppercase tracking-wider">Items</span>
              <p className="text-white font-medium mt-1">{release.items?.length ?? 0}</p>
            </div>
          </div>
        </div>

        {/* Items */}
        <div>
          <h2 className="text-lg font-medium text-white mb-4">Release Items</h2>
          {(!release.items || release.items.length === 0) ? (
            <p className="text-surface-500 text-sm">No items in this release.</p>
          ) : (
            <div className="space-y-3">
              {release.items.map((item) => (
                <div key={item.id} className="bg-surface-900/50 border border-surface-800 rounded-xl p-5">
                  <div className="flex items-start gap-3">
                    <span className="text-xs font-mono text-surface-400 bg-surface-800 px-2 py-0.5 rounded shrink-0">
                      {item.displayId}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[item.itemType] || "bg-surface-700 text-surface-300"}`}>
                          {item.itemType.replace(/_/g, " ")}
                        </span>
                      </div>
                      <h3 className="text-white font-medium">{item.title}</h3>
                      <p className="text-surface-400 text-sm mt-1 whitespace-pre-wrap">{item.content}</p>
                      <p className="text-surface-600 text-xs mt-2 font-mono truncate" title={item.contentHash}>
                        Hash: {item.contentHash.substring(0, 16)}…
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
