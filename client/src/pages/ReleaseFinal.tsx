import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchRelease, fetchStatements, fetchAnalysis, finalizeRelease, type Release, type Statement, type AiAnalysis } from "../api";

export default function ReleaseFinal() {
  const { id } = useParams<{ id: string }>();
  const [release, setRelease] = useState<Release | null>(null);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([fetchRelease(id), fetchStatements(id), fetchAnalysis(id)])
      .then(([rel, stmts, an]) => {
        setRelease(rel);
        setStatements(stmts);
        setAnalysis(an);
      })
      .catch((err) => setError(err.message))
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
      setError(err instanceof Error ? err.message : "Failed to finalize");
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
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-10">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl text-sm">
            {error}
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
