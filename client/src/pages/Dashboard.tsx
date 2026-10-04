import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Release } from "../api";
import { fetchReleases } from "../api";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  ANALYZED: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  IN_REVIEW: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  FINAL: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

export default function Dashboard() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchReleases()
      .then(setReleases)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-surface-800 bg-surface-950/80 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
              <span className="text-white font-bold text-sm">RA</span>
            </div>
            <h1 className="text-xl font-semibold text-white tracking-tight">ReleaseAnalyst</h1>
          </div>
          <div className="flex gap-3">
            <button
              onClick={async () => {
                try {
                  const { generateDemoRelease } = await import("../api");
                  await generateDemoRelease();
                  window.location.reload();
                } catch (err) {
                  alert(err instanceof Error ? err.message : "Demo failed");
                }
              }}
              className="px-4 py-2 bg-surface-800 hover:bg-surface-700 text-white rounded-lg text-sm font-medium transition-all duration-200 border border-surface-700 hover:shadow-lg"
            >
              Load Demo Release
            </button>
            <Link
              to="/create"
              id="create-release-btn"
              className="px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg text-sm font-medium transition-all duration-200 hover:shadow-lg hover:shadow-primary-600/25"
            >
              + Create Release
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-white mb-1">Releases</h2>
          <p className="text-surface-400 text-sm">Manage your release packages and communication briefs</p>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">
            {error}
          </div>
        )}

        {!loading && !error && releases.length === 0 && (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-surface-800/50 flex items-center justify-center">
              <svg className="w-8 h-8 text-surface-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-surface-300 mb-1">No releases yet</h3>
            <p className="text-surface-500 text-sm mb-6">Create your first release package to get started</p>
            <Link
              to="/create"
              className="inline-flex px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg text-sm font-medium transition-all duration-200"
            >
              + Create Release
            </Link>
          </div>
        )}

        {!loading && !error && releases.length > 0 && (
          <div className="grid gap-3">
            {releases.map((release) => (
              <Link
                key={release.id}
                to={`/releases/${release.id}`}
                className="group block bg-surface-900/50 hover:bg-surface-800/70 border border-surface-800 hover:border-surface-700 rounded-xl p-5 transition-all duration-200"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-xs font-mono text-surface-400 bg-surface-800 px-2 py-0.5 rounded">
                        v{release.version}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[release.status] || "bg-surface-700 text-surface-300"}`}>
                        {release.status.replace("_", " ")}
                      </span>
                      {release.title.startsWith("DEMO ") && (
                        <span className="text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold tracking-wide">
                          DEMO
                        </span>
                      )}
                    </div>
                    <h3 className="text-white font-medium group-hover:text-primary-400 transition-colors truncate">
                      {release.title}
                    </h3>
                    <div className="flex items-center gap-4 mt-2 text-xs text-surface-500">
                      <span>{release._count?.items ?? 0} items</span>
                      <span>{new Date(release.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-surface-600 group-hover:text-surface-400 transition-colors mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
