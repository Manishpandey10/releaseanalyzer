import { useState, useEffect } from "react";
import { useNavigate, Link, useParams } from "react-router-dom";
import { fetchRelease, updateRelease } from "../api";

const ITEM_TYPES = [
  { value: "FEATURE", label: "Feature", prefix: "F", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { value: "BUG_FIX", label: "Bug Fix", prefix: "B", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  { value: "BEHAVIOR_CHANGE", label: "Behavior Change", prefix: "C", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  { value: "QA_EVIDENCE", label: "QA Evidence", prefix: "QA", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  { value: "LIMITATION", label: "Limitation", prefix: "LIMIT", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  { value: "MIGRATION_NOTE", label: "Migration Note", prefix: "MIGRATION", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  { value: "AFFECTED_GROUP", label: "Affected Group", prefix: "GROUP", color: "bg-surface-500/20 text-surface-400 border-surface-500/30" },
] as const;

interface ItemDraft {
  id: string; // string to hold real IDs or temporary ones
  itemType: string;
  title: string;
  content: string;
  sortOrder?: number;
}

let tempIdCounter = 1;

export default function EditRelease() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [version, setVersion] = useState("");
  const [title, setTitle] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [initialData, setInitialData] = useState<{
    version: string;
    title: string;
    items: ItemDraft[];
  } | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchRelease(id)
      .then((rel) => {
        setVersion(rel.version);
        setTitle(rel.title);
        const mappedItems = rel.items
          ? rel.items.map((i) => ({
              id: i.id,
              itemType: i.itemType,
              title: i.title,
              content: i.content,
              sortOrder: i.sortOrder,
            }))
          : [];
        setItems(mappedItems);
        // existing items load collapsed — none in the expandedIds set
        setInitialData({ version: rel.version, title: rel.title, items: mappedItems });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const isDirty =
    initialData !== null &&
    (version !== initialData.version ||
      title !== initialData.title ||
      items.length !== initialData.items.length ||
      items.some((item, i) => {
        const orig = initialData.items[i];
        if (!orig) return true;
        return (
          item.itemType !== orig.itemType ||
          item.title !== orig.title ||
          item.content !== orig.content
        );
      }));

  function addItem() {
    const newId = `temp-${tempIdCounter++}`;
    setItems((prev) => [...prev, { id: newId, itemType: "FEATURE", title: "", content: "" }]);
    setExpandedIds((prev) => new Set(prev).add(newId)); // new item starts expanded
  }

  function toggleExpanded(itemId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function updateItem(itemId: string, field: keyof ItemDraft, value: string) {
    setItems(items.map((item) => (item.id === itemId ? { ...item, [field]: value } : item)));
  }

  function removeItem(itemId: string) {
    setItems(items.filter((item) => item.id !== itemId));
    setExpandedIds((prev) => { const next = new Set(prev); next.delete(itemId); return next; });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setError(null);
    setSubmitting(true);
    try {
      await updateRelease(id, {
        version,
        title,
        items: items.map(({ itemType, title, content, sortOrder }) => ({ itemType, title, content, sortOrder })),
      });
      navigate(`/releases/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update release");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full bg-surface-800/50 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all";
  const labelClass = "block text-sm font-medium text-surface-300 mb-1.5";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-surface-800 bg-surface-950/80 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to={`/releases/${id}`} className="text-surface-400 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-lg font-semibold text-white">Edit Release</h1>
          </div>
          <Link to="/" className="px-3 py-1.5 bg-surface-800 hover:bg-surface-700 text-surface-300 hover:text-white text-sm font-medium rounded-lg transition-colors border border-surface-700 flex items-center gap-2" title="Home">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            <span className="hidden sm:inline">Home</span>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 pb-32">
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="bg-surface-900/50 border border-surface-800 rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-medium text-white mb-4">Release Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="version" className={labelClass}>Version</label>
                <input id="version" type="text" required value={version} onChange={(e) => setVersion(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label htmlFor="title" className={labelClass}>Title</label>
                <input id="title" type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
              </div>
            </div>
          </div>

          {/* Release items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-white">
                Release Items
                {items.length > 0 && (
                  <span className="ml-2 text-xs font-mono text-surface-500">({items.length})</span>
                )}
              </h2>
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

            {items.map((item, idx) => {
              const isOpen = expandedIds.has(item.id);
              const typeInfo = ITEM_TYPES.find((t) => t.value === item.itemType) ?? ITEM_TYPES[0];

              return (
                <div
                  key={item.id}
                  className="bg-surface-900/50 border border-surface-800 rounded-xl overflow-hidden"
                >
                  {/* Collapsible header */}
                  <button
                    type="button"
                    onClick={() => toggleExpanded(item.id)}
                    className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-surface-800/40 transition-colors group"
                  >
                    {/* Chevron */}
                    <svg
                      className={`w-4 h-4 text-surface-500 group-hover:text-surface-300 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>

                    {/* Type badge */}
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border shrink-0 ${typeInfo.color}`}>
                      {typeInfo.prefix}
                    </span>

                    {/* Title preview */}
                    <span className="text-sm text-surface-300 truncate flex-1 group-hover:text-white transition-colors">
                      {item.title || <span className="text-surface-600 italic">Item #{idx + 1} — untitled</span>}
                    </span>

                    {/* Index */}
                    <span className="text-xs font-mono text-surface-600 shrink-0">#{idx + 1}</span>

                    {/* Remove */}
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); removeItem(item.id); } }}
                      className="text-surface-600 hover:text-red-400 transition-colors shrink-0 p-1 rounded"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </span>
                  </button>

                  {/* Collapsible body */}
                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 space-y-3 border-t border-surface-800/60">
                      <div>
                        <label className={labelClass}>Type</label>
                        <select
                          value={item.itemType}
                          onChange={(e) => updateItem(item.id, "itemType", e.target.value)}
                          className={inputClass}
                        >
                          {ITEM_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>{t.label} ({t.prefix})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>Title</label>
                        <input
                          type="text"
                          required
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
                          value={item.content}
                          onChange={(e) => updateItem(item.id, "content", e.target.value)}
                          className={`${inputClass} resize-y`}
                        />
                      </div>
                      <p className="text-[11px] text-surface-500 mt-1 pl-1">
                        Hint: Title is a short label. Content is the full statement and is what the AI reads.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">{error}</div>
          )}

          {/* Floating Action Bar */}
          <div
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ease-out ${
              isDirty
                ? "opacity-100 translate-y-0 pointer-events-auto"
                : "opacity-0 translate-y-8 pointer-events-none"
            }`}
          >
            <div className="flex items-center gap-4 bg-surface-900/95 backdrop-blur-xl border border-surface-700 shadow-2xl shadow-black/80 px-5 py-3 rounded-2xl ring-1 ring-white/10">
              <div className="flex items-center gap-2 pr-1">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                </span>
                <span className="text-xs sm:text-sm font-medium text-surface-200 whitespace-nowrap">
                  Unsaved changes
                </span>
              </div>

              <div className="h-5 w-px bg-surface-700" />

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate(`/releases/${id}`)}
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
