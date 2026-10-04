import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import type { Release, ValidationResult } from "../api";
import { fetchRelease, validateRelease } from "../api";
import LifecycleStepper from "../components/LifecycleStepper";
import WhatsNext from "../components/WhatsNext";

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

function hasNumberMismatch(title: string, content: string): boolean {
  const numRegex = /\b\d+(?:\.\d+)?%?|\b\d{1,3}(?:,\d{3})+\b/g;
  const titleNums = new Set((title.match(numRegex) || []).map(n => n.replace(/,/g, "")));
  if (titleNums.size === 0) return false;
  
  const contentNums = new Set((content.match(numRegex) || []).map(n => n.replace(/,/g, "")));
  // If content has no numbers at all, it's not a contradiction, just an omission.
  if (contentNums.size === 0) return false;
  
  // Warn only if there's a number in the title that is missing from the content,
  // which indicates a potential contradiction since content DOES have numbers.
  for (const n of titleNums) {
    if (!contentNums.has(n)) return true;
  }
  return false;
}

export default function ReleaseDetail() {
  const { id } = useParams<{ id: string }>();
  const [release, setRelease] = useState<Release | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // New version modal state
  const [versionModalOpen, setVersionModalOpen] = useState(false);
  const [newVersionInput, setNewVersionInput] = useState("");
  const [creatingVersion, setCreatingVersion] = useState(false);
  const [versionError, setVersionError] = useState<string | null>(null);

  const handleCreateVersion = async () => {
    if (!release || !newVersionInput.trim()) return;
    setCreatingVersion(true);
    setVersionError(null);
    try {
      const { createVersion } = await import("../api");
      const res = await createVersion(release.id, newVersionInput.trim());
      window.location.href = `/releases/${res.id}`;
    } catch (err) {
      setVersionError(err instanceof Error ? err.message : "Failed to create version");
      setCreatingVersion(false);
    }
  };

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

  const handleValidate = async () => {
    if (!release) return;
    setValidating(true);
    setValidationError(null);
    try {
      const res = await validateRelease(release.id);
      setValidationResult(res);
    } catch (err: any) {
      setValidationError(err.message);
    } finally {
      setValidating(false);
    }
  };

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
            <Link to="/" className="px-3 py-1.5 bg-surface-800 hover:bg-surface-700 text-surface-300 hover:text-white text-sm font-medium rounded-lg transition-colors border border-surface-700 flex items-center gap-2" title="Home">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
              <span className="hidden sm:inline">Home</span>
            </Link>
            <button
              onClick={handleValidate}
              disabled={validating}
              className="px-4 py-1.5 bg-surface-800 hover:bg-surface-700 text-white text-sm font-medium rounded-lg transition-colors border border-surface-700 disabled:opacity-50"
            >
              {validating ? "Validating..." : "Validate"}
            </button>
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
                onClick={() => {
                  setVersionModalOpen(true);
                  setNewVersionInput("");
                  setVersionError(null);
                }}
                className="px-4 py-1.5 bg-surface-800 hover:bg-surface-700 text-white text-sm font-medium rounded-lg transition-colors border border-surface-700"
              >
                Create New Version
              </button>
            )}
            {(() => {
              const ch = release.items?.filter(i => i.itemType === "FEATURE" || i.itemType === "BUG_FIX").length ?? 0;
              const bc = release.items?.filter(i => i.itemType === "BEHAVIOR_CHANGE").length ?? 0;
              const qa = release.items?.filter(i => i.itemType === "QA_EVIDENCE").length ?? 0;
              const lm = release.items?.filter(i => i.itemType === "LIMITATION").length ?? 0;
              const mn = release.items?.filter(i => i.itemType === "MIGRATION_NOTE").length ?? 0;
              const ag = release.items?.filter(i => i.itemType === "AFFECTED_GROUP").length ?? 0;
              const canAnalyze = ch > 0 && bc > 0 && qa > 0 && lm > 0 && mn > 0 && ag > 0;

              if (!canAnalyze) {
                return (
                  <button
                    disabled
                    title="Requires at least 1 of each section: Changes, Behavior Change, QA, Limitation, Migration Note, Affected Group"
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
        <LifecycleStepper releaseId={release.id} status={release.status as any} />
        
        <WhatsNext 
          releaseId={release.id} 
          status={release.status as any}
          canAnalyze={(() => {
            const ch = release.items?.filter(i => i.itemType === "FEATURE" || i.itemType === "BUG_FIX" || i.itemType === "BEHAVIOR_CHANGE").length ?? 0;
            const qa = release.items?.filter(i => i.itemType === "QA_EVIDENCE").length ?? 0;
            return ch > 0 && qa > 0;
          })()}
        />

        {/* Metadata */}
        <div className="bg-surface-900/50 border border-surface-800 rounded-xl p-6">
          <div className="flex flex-col md:flex-row gap-6 md:items-center justify-between">
            <div className="flex gap-8">
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
            
            {/* Version Lineage / History */}
            <div className="bg-surface-950/50 p-4 rounded-lg border border-surface-800 md:min-w-[300px]">
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
              ) : (
                <>
                  <span className="text-xs text-surface-500 uppercase tracking-wider mb-3 block">Version Lineage</span>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col">
                      <span className="text-white font-mono text-sm font-medium">v{release.version}</span>
                      <span className="text-surface-400 text-xs truncate max-w-[200px]" title={release.title}>{release.title}</span>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${STATUS_COLORS[release.status] || "bg-surface-800"}`}>{release.status.replace("_", " ")}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Validation Result */}
        {validationError && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400">
            {validationError}
          </div>
        )}
        {validationResult && (
          <div className="bg-surface-900/50 border border-surface-800 rounded-xl p-6">
            <h2 className="text-lg font-medium text-white mb-4">Validation Status</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              {validationResult.sections.map(s => (
                <div key={s.key} className="flex items-center gap-3 bg-surface-800/50 p-3 rounded-lg border border-surface-700">
                  {s.present ? (
                    <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  ) : (
                    <svg className="w-5 h-5 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  )}
                  <span className="text-sm font-medium text-surface-200">{s.label}</span>
                </div>
              ))}
            </div>
            {!validationResult.valid && (
              <ul className="list-disc list-inside text-sm text-red-400 space-y-1">
                {validationResult.issues.map((iss, i) => (
                  <li key={i}>{iss}</li>
                ))}
              </ul>
            )}
            {validationResult.valid && (
              <p className="text-sm text-emerald-400 font-medium">Ready for analysis!</p>
            )}
          </div>
        )}

        {/* Items */}
        <div>
          <h2 className="text-lg font-medium text-white mb-4">Release Items</h2>
          {(!release.items || release.items.length === 0) ? (
            <p className="text-surface-500 text-sm">No items in this release.</p>
          ) : (
            <div className="space-y-3">
              {release.items.map((item) => {
                const mismatch = hasNumberMismatch(item.title, item.content);
                return (
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
                          {mismatch && (
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded border bg-amber-500/10 text-amber-400 border-amber-500/30">
                              ⚠ Number Mismatch
                            </span>
                          )}
                        </div>
                        <h3 className="text-white font-medium">{item.title}</h3>
                        {mismatch && (
                          <p className="text-amber-400/80 text-xs mt-1 font-medium">
                            Warning: The numbers in the title and content do not match.
                          </p>
                        )}
                        <p className="text-surface-400 text-sm mt-1 whitespace-pre-wrap">{item.content}</p>
                        <p className="text-surface-600 text-xs mt-2 font-mono truncate" title={item.contentHash}>
                          Hash: {item.contentHash.substring(0, 16)}…
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Create Version Modal */}
        {versionModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => !creatingVersion && setVersionModalOpen(false)}
            />
            
            {/* Modal Content */}
            <div className="relative bg-surface-900 border border-surface-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-[fadeIn_0.2s_ease-out]">
              <div className="p-6 space-y-4">
                <div>
                  <h3 className="text-xl font-semibold text-white">Create New Version</h3>
                  <p className="text-sm text-surface-400 mt-1">
                    Clone this release into a new version to continue working.
                  </p>
                </div>
                
                <div>
                  <label htmlFor="newVersion" className="block text-sm font-medium text-surface-300 mb-1.5">
                    New Version Number
                  </label>
                  <input
                    id="newVersion"
                    type="text"
                    required
                    placeholder="e.g. 1.1.0"
                    value={newVersionInput}
                    onChange={(e) => setNewVersionInput(e.target.value)}
                    className="w-full bg-surface-800 border border-surface-600 rounded-lg px-3 py-2 text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
                    autoFocus
                  />
                </div>

                {versionError && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
                    {versionError}
                  </div>
                )}
              </div>
              
              <div className="border-t border-surface-800 bg-surface-900/50 p-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setVersionModalOpen(false)}
                  disabled={creatingVersion}
                  className="px-4 py-2 text-sm font-medium text-surface-300 hover:text-white bg-surface-800 hover:bg-surface-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateVersion}
                  disabled={creatingVersion || !newVersionInput.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-500 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-primary-600/20"
                >
                  {creatingVersion && (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  {creatingVersion ? "Creating..." : "Create Version"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
