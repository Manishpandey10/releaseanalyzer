import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchRelease, fetchStatements, updateStatementContent, approveStatement, rejectStatement, resolveStatement, type Release, type Statement } from "../api";

const IMPACT_COLORS: Record<string, string> = {
  LOW: "text-emerald-400 border-emerald-500/30",
  MEDIUM: "text-amber-400 border-amber-500/30",
  HIGH: "text-red-400 border-red-500/30",
};

const SUPPORT_COLORS: Record<string, string> = {
  SUPPORTED: "text-emerald-400 border-emerald-500/30",
  PARTIALLY_SUPPORTED: "text-amber-400 border-amber-500/30",
  UNSUPPORTED: "text-red-400 border-red-500/30",
};

const REVIEW_COLORS: Record<string, string> = {
  PENDING: "bg-surface-800 text-surface-300",
  APPROVED: "bg-emerald-500/20 text-emerald-400",
  REJECTED: "bg-red-500/20 text-red-400",
};

export default function ReleaseReview() {
  const { id } = useParams<{ id: string }>();
  const [release, setRelease] = useState<Release | null>(null);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolveNote, setResolveNote] = useState("");

  useEffect(() => {
    if (!id) return;
    Promise.all([fetchRelease(id), fetchStatements(id)])
      .then(([rel, stmts]) => {
        setRelease(rel);
        setStatements(stmts);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleApprove = async (stmtId: string) => {
    if (!id) return;
    try {
      const updated = await approveStatement(id, stmtId);
      setStatements(prev => prev.map(s => s.id === stmtId ? { ...s, ...updated } : s));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to approve");
    }
  };

  const handleReject = async (stmtId: string) => {
    if (!id) return;
    try {
      const updated = await rejectStatement(id, stmtId);
      setStatements(prev => prev.map(s => s.id === stmtId ? { ...s, ...updated } : s));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to reject");
    }
  };

  const handleSaveEdit = async (stmtId: string) => {
    if (!id || !editContent.trim()) return;
    try {
      const updated = await updateStatementContent(id, stmtId, editContent);
      setStatements(prev => prev.map(s => s.id === stmtId ? { ...s, ...updated } : s));
      setEditingId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update");
    }
  };

  const handleResolve = async (stmtId: string) => {
    if (!id) return;
    try {
      const updated = await resolveStatement(id, stmtId, resolveNote);
      setStatements(prev => prev.map(s => s.id === stmtId ? { ...s, ...updated } : s));
      setResolvingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resolve statement");
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

  const internalStmts = statements.filter(s => s.audience === "INTERNAL");
  const clientStmts = statements.filter(s => s.audience === "CLIENT");

  const renderStatementList = (list: Statement[]) => {
    if (list.length === 0) return <p className="text-surface-500 text-sm">No statements available.</p>;

    return (
      <div className="space-y-4">
        {list.map(stmt => (
          <div key={stmt.id} className="bg-surface-900/50 border border-surface-800 rounded-xl p-5 relative">
            
            {/* Status Badge */}
            <div className="absolute top-4 right-5 flex gap-2">
              {stmt.isStale && (
                <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">
                  ⚠ STALE
                </span>
              )}
              <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold ${REVIEW_COLORS[stmt.reviewStatus]}`}>
                {stmt.reviewStatus}
              </span>
            </div>

            <div className="mb-3 pr-24 flex items-center gap-3">
              <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold border ${IMPACT_COLORS[stmt.impact] || IMPACT_COLORS.MEDIUM}`}>
                {stmt.impact} IMPACT
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold border ${SUPPORT_COLORS[stmt.supportStatus] || SUPPORT_COLORS.UNSUPPORTED}`}>
                {stmt.supportStatus.replace("_", " ")}
              </span>
            </div>
            
            {/* Content */}
            {editingId === stmt.id ? (
              <div className="space-y-3 mt-3">
                <textarea
                  className="w-full bg-surface-950 border border-surface-700 rounded-lg p-3 text-sm text-white focus:ring-2 focus:ring-primary-500 focus:outline-none resize-y"
                  rows={3}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                />
                <div className="flex gap-2">
                  <button onClick={() => handleSaveEdit(stmt.id)} className="px-3 py-1.5 bg-primary-600 hover:bg-primary-500 text-white rounded text-xs transition-colors">Save</button>
                  <button onClick={() => setEditingId(null)} className="px-3 py-1.5 bg-surface-800 hover:bg-surface-700 text-white rounded text-xs transition-colors">Cancel</button>
                </div>
              </div>
            ) : (
              <p className="text-surface-200 text-sm leading-relaxed mt-2">{stmt.statement}</p>
            )}

            {/* Evidence Tags */}
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="text-xs text-surface-500">Evidence:</span>
              {stmt.evidence.map((ev, idx) => (
                <span key={idx} className="text-[10px] font-mono bg-surface-800 text-surface-400 px-1.5 py-0.5 rounded">
                  [{ev.releaseItem?.displayId || "Unknown"}]
                </span>
              ))}
            </div>

            {/* Stale Reasons */}
            {stmt.isStale && stmt.reasons && stmt.reasons.length > 0 && (
              <div className="mt-4 bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
                <span className="text-xs text-orange-400 font-semibold mb-2 block">Staleness Reasons:</span>
                <div className="space-y-1">
                  {stmt.reasons.map((r, i) => (
                    <div key={i} className="flex gap-2 text-xs">
                      <span className="font-mono text-surface-400">[{r.displayId}]</span>
                      <span className="text-orange-300">{r.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Resolve Form */}
            {resolvingId === stmt.id && (
              <div className="mt-4 p-3 bg-surface-950 border border-surface-700 rounded-lg">
                <label className="text-xs text-surface-400 mb-1 block">Resolution Note (min 5 chars)</label>
                <textarea
                  className="w-full bg-surface-900 border border-surface-700 rounded p-2 text-sm text-white focus:ring-1 focus:ring-primary-500 outline-none mb-2"
                  rows={2}
                  value={resolveNote}
                  onChange={(e) => setResolveNote(e.target.value)}
                />
                <div className="flex gap-2">
                  <button onClick={() => handleResolve(stmt.id)} className="px-3 py-1 bg-orange-600 hover:bg-orange-500 text-white rounded text-xs">Submit</button>
                  <button onClick={() => setResolvingId(null)} className="px-3 py-1 bg-surface-800 hover:bg-surface-700 text-white rounded text-xs">Cancel</button>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="mt-5 pt-4 border-t border-surface-800/50 flex items-center justify-between">
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setEditingId(stmt.id);
                    setEditContent(stmt.statement);
                  }}
                  className="text-xs text-surface-400 hover:text-white transition-colors"
                >
                  Edit Content
                </button>
                {stmt.isStale && (
                  <button
                    onClick={() => {
                      setResolvingId(stmt.id);
                      setResolveNote("");
                    }}
                    className="text-xs text-orange-400 hover:text-orange-300 transition-colors"
                  >
                    Resolve
                  </button>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleReject(stmt.id)}
                  disabled={stmt.reviewStatus === "REJECTED"}
                  className="px-3 py-1.5 border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Reject
                </button>
                <button
                  onClick={() => handleApprove(stmt.id)}
                  disabled={stmt.reviewStatus === "APPROVED" || stmt.isStale}
                  title={stmt.isStale ? "Cannot approve a stale statement" : ""}
                  className="px-3 py-1.5 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30 rounded text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Approve
                </button>
              </div>
            </div>

          </div>
        ))}
      </div>
    );
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
            <h1 className="text-lg font-semibold text-white truncate">Review AI Statements: {release.title}</h1>
          </div>
          <Link
            to={`/releases/${release.id}/final`}
            className="px-4 py-1.5 bg-primary-600 hover:bg-primary-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Finalize Release
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-10">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl text-sm">
            {error}
          </div>
        )}

        {/* Internal Statements */}
        <section className="space-y-4">
          <h2 className="text-lg font-medium text-white flex items-center gap-2">
            <span className="w-1.5 h-6 bg-purple-500 rounded-full"></span>
            Internal Technical Summary
          </h2>
          {renderStatementList(internalStmts)}
        </section>

        {/* Client Statements */}
        <section className="space-y-4">
          <h2 className="text-lg font-medium text-white flex items-center gap-2">
            <span className="w-1.5 h-6 bg-cyan-500 rounded-full"></span>
            Client / Stakeholder Summary
          </h2>
          {renderStatementList(clientStmts)}
        </section>
      </main>
    </div>
  );
}
