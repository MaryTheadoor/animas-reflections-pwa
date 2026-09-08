"use client";

import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { useSiteConfig, useSiteConfigRefresh } from "@/hooks/useSiteConfig";
import { COPY_PAGES, getContentPath, getContentArray, addContentItem, removeContentItem, setContentPath, type SiteContent } from "@/lib/content-schema";

const REGION_COLORS: Record<string, string> = {
  "Top bar": "bg-plum",
  Header: "bg-plum",
  Hero: "bg-gold",
  Body: "bg-primary",
  About: "bg-primary",
  Intro: "bg-primary",
  "Contact card": "bg-primary",
  Contact: "bg-primary",
  CTA: "bg-gold",
  Footer: "bg-plum",
};

export default function CopyEditor() {
  const config = useSiteConfig();
  const refresh = useSiteConfigRefresh();
  const [pageId, setPageId] = useState(COPY_PAGES[0].id);
  const [draft, setDraft] = useState<SiteContent>(config.content);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const page = COPY_PAGES.find((p) => p.id === pageId) ?? COPY_PAGES[0];

  const getVal = (path: string) => getContentPath(draft, path) as string | boolean;
  const setVal = (path: string, value: string | boolean) => setDraft((c) => setContentPath(c, path, value));
  const isDirty = JSON.stringify(draft) !== JSON.stringify(config.content);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const callable = httpsCallable(functions, "saveSiteConfig");
      await callable({ content: draft } as unknown as Record<string, unknown>);
      refresh();
      setDraft(config.content);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      alert("Failed to save: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold font-display mb-1">Copy</h2>
          <p className="text-sm text-foreground/70">
            Edit text page by page. Pick a page, then edit the fields below. Save applies site-wide.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDraft(config.content)}
            disabled={!isDirty}
            className="px-3 py-2 rounded-xl text-xs font-medium text-primary border border-primary/20 hover:border-primary/40 transition-colors disabled:opacity-40"
          >
            Discard changes
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="px-5 py-2 rounded-xl text-sm font-medium bg-gold text-white hover:bg-gold-light transition-colors disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save copy"}
          </button>
        </div>
      </div>

      {saved && <p className="text-sm text-green-700">Saved! The copy is now live.</p>}

      {/* Page selector */}
      <div className="flex flex-wrap gap-1.5">
        {COPY_PAGES.map((p) => (
          <button
            key={p.id}
            onClick={() => setPageId(p.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              pageId === p.id ? "bg-primary text-white" : "text-foreground border border-primary/15 hover:bg-warm-sand/50"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
        {/* Wireframe diagram */}
        <div className="bg-warm-sand/20 rounded-xl border border-warm-sand p-3 space-y-1.5 self-start">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground/50 mb-2">
            {page.label} — {page.route}
          </p>
          <div className="space-y-1.5">
            <div className="h-6 rounded bg-plum/20 flex items-center px-2 text-[10px] text-plum">nav</div>
            {page.regions.map((r, i) => (
              <div
                key={r}
                className={`rounded px-2 text-[11px] flex items-center gap-2 ${
                  i === 0 ? "h-10 bg-warm-sand" : "h-12 bg-warm-sand"
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${REGION_COLORS[r] ?? "bg-foreground/30"}`} />
                <span className="text-foreground/70">{r}</span>
              </div>
            ))}
            <div className="h-6 rounded bg-plum/20 flex items-center px-2 text-[10px] text-plum">footer</div>
          </div>
          <p className="text-[10px] text-foreground/50 mt-2">Each field below maps to a block above.</p>
        </div>

        {/* Fields */}
        <div className="space-y-3">
          {page.fields.map((f) => {
            const val = getVal(f.key);
            const color = REGION_COLORS[f.region] ?? "bg-foreground/30";
            const common = "w-full px-3 py-2 rounded-lg border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm bg-white";
            return (
              <div key={f.key} className="bg-white border border-warm-sand rounded-xl p-3 space-y-1.5">
                <label className="text-xs font-medium text-primary flex items-center gap-2">
                  <span className={`inline-block w-2.5 h-2.5 rounded-full ${color}`} />
                  {f.label}
                  <span className="text-[10px] text-foreground/50 font-normal">{f.region}</span>
                </label>
                {f.type === "textarea" ? (
                  <textarea
                    value={typeof val === "string" ? val : ""}
                    onChange={(e) => setVal(f.key, e.target.value)}
                    rows={3}
                    className={`${common} resize-y`}
                  />
                ) : f.type === "toggle" ? (
                  <input type="checkbox" checked={!!val} onChange={(e) => setVal(f.key, e.target.checked)} className="accent-gold w-4 h-4" />
                ) : f.type === "list" ? (
                  <div className="space-y-2">
                    {(getContentArray(draft, f.key) as Record<string, string>[]).map((item, i) => (
                      <div key={i} className="bg-warm-sand/30 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] text-foreground/50">{f.itemLabel ?? "item"} {i + 1}</span>
                          <button
                            onClick={() => setDraft((c) => removeContentItem(c, f.key, i))}
                            className="text-red-400 hover:text-red-600 text-xs"
                          >
                            Remove
                          </button>
                        </div>
                        {(f.itemFields ?? []).map((sf) => (
                          <div key={sf.key + i}>
                            <label className="text-[10px] text-foreground/60 block mb-1">{sf.label}</label>
                            {sf.type === "textarea" ? (
                              <textarea
                                value={item[sf.key] ?? ""}
                                onChange={(e) => setVal(f.key + "." + i + "." + sf.key, e.target.value)}
                                rows={2}
                                className={`${common} resize-y`}
                              />
                            ) : (
                              <input
                                type="text"
                                value={item[sf.key] ?? ""}
                                onChange={(e) => setVal(f.key + "." + i + "." + sf.key, e.target.value)}
                                className={common}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        const tpl: Record<string, unknown> = {};
                        (f.itemFields ?? []).forEach((sf) => { tpl[sf.key] = ""; });
                        setDraft((c) => addContentItem(c, f.key, tpl));
                      }}
                      className="w-full py-1.5 border-2 border-dashed border-primary/20 rounded-lg text-xs text-foreground/70 hover:border-primary/40 transition-colors"
                    >
                      + Add {f.itemLabel ?? "item"}
                    </button>
                  </div>
                ) : (
                  <input
                    type="text"
                    value={typeof val === "string" ? val : ""}
                    onChange={(e) => setVal(f.key, e.target.value)}
                    className={common}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
