import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createRelease } from "../api";

const ITEM_TYPES = [
  { value: "FEATURE", label: "Feature", prefix: "F" },
  { value: "BUG_FIX", label: "Bug Fix", prefix: "B" },
  { value: "BEHAVIOR_CHANGE", label: "Behavior Change", prefix: "C" },
  { value: "QA_EVIDENCE", label: "QA Evidence", prefix: "QA" },
  { value: "LIMITATION", label: "Limitation", prefix: "LIMIT" },
  { value: "MIGRATION_NOTE", label: "Migration Note", prefix: "MIGRATION" },
  { value: "AFFECTED_GROUP", label: "Affected Group", prefix: "GROUP" },
] as const;

interface ItemDraft {
  id: number;
  itemType: string;
  title: string;
  content: string;
}

let nextId = 1;

export default function CreateRelease() {
  const navigate = useNavigate();
  const [version, setVersion] = useState("");
  const [title, setTitle] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addItem() {
    setItems([...items, { id: nextId++, itemType: "FEATURE", title: "", content: "" }]);
  }

  function updateItem(id: number, field: keyof ItemDraft, value: string) {
    setItems(items.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  }

  function removeItem(id: number) {
    setItems(items.filter((item) => item.id !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const release = await createRelease({
        version,
        title,
        items: items.map(({ itemType, title, content }) => ({ itemType, title, content })),
      });
      navigate(`/releases/${release.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create release");
    } finally {
      setSubmitting(false);
    }
  }

  const hasValues =
    version.trim().length > 0 ||
    title.trim().length > 0 ||
    items.length > 0;

  const inputClass =
    "w-full bg-surface-800/50 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all";
  const labelClass = "block text-sm font-medium text-surface-300 mb-1.5";

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-surface-800 bg-surface-950/80 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link to="/" className="text-surface-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-lg font-semibold text-white">Create Release</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 pb-32">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Release metadata */}
          <div className="bg-surface-900/50 border border-surface-800 rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-medium text-white mb-4">Release Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="version" className={labelClass}>Version</label>
                <input
                  id="version"
                  type="text"
                  required
                  placeholder="e.g. 2.4.0"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="title" className={labelClass}>Title</label>
                <input
                  id="title"
                  type="text"
                  required
                  placeholder="e.g. October Maintenance Release"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Release items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-white">Release Items</h2>
              <button
                type="button"
                onClick={addItem}
                className="px-3 py-1.5 text-sm bg-surface-800 hover:bg-surface-700 text-surface-300 hover:text-white border border-surface-700 rounded-lg transition-all"
              >
                + Add Item
              </button>
            </div>

            {items.length === 0 && (
              <div className="bg-surface-900/30 border border-dashed border-surface-700 rounded-xl p-8 text-center">
                <p className="text-surface-500 text-sm">No items yet. Add features, bug fixes, and other changes.</p>
              </div>
            )}

            {items.map((item, idx) => (
              <div
                key={item.id}
                className="bg-surface-900/50 border border-surface-800 rounded-xl p-5 space-y-3 animate-[fadeIn_0.2s_ease-out]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-surface-500">Item #{idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="text-surface-500 hover:text-red-400 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div>
                  <label className={labelClass}>Type</label>
                  <select
                    value={item.itemType}
                    onChange={(e) => updateItem(item.id, "itemType", e.target.value)}
                    className={inputClass}
                  >
                    {ITEM_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label} ({t.prefix})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Title</label>
                  <input
                    type="text"
                    required
                    placeholder="Brief item title"
                    value={item.title}
                    onChange={(e) => updateItem(item.id, "title", e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Content</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Detailed description of this item..."
                    value={item.content}
                    onChange={(e) => updateItem(item.id, "content", e.target.value)}
                    className={`${inputClass} resize-y`}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Floating Action Bar - appears when user enters any values */}
          <div
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ease-out ${
              hasValues
                ? "opacity-100 translate-y-0 pointer-events-auto"
                : "opacity-0 translate-y-8 pointer-events-none"
            }`}
          >
            <div className="flex items-center gap-4 bg-surface-900/95 backdrop-blur-xl border border-surface-700 shadow-2xl shadow-black/80 px-5 py-3 rounded-2xl ring-1 ring-white/10">
              <div className="flex items-center gap-2 pr-1">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary-500"></span>
                </span>
                <span className="text-xs sm:text-sm font-medium text-surface-200 whitespace-nowrap">
                  Draft in progress
                </span>
              </div>

              <div className="h-5 w-px bg-surface-700" />

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate("/")}
                  className="px-4 py-2 text-xs sm:text-sm font-medium text-surface-300 hover:text-white hover:bg-surface-800 rounded-xl transition-all"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-medium transition-all shadow-md shadow-primary-600/30 flex items-center gap-2 whitespace-nowrap"
                >
                  {submitting && (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  <span>{submitting ? "Saving..." : "Save Changes"}</span>
                </button>
              </div>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
