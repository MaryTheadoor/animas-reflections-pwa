"use client";

import { useMemo, useState } from "react";
import { searchHelp, TUTORIALS } from "@/lib/help-content";

export default function HelpGuide() {
  const [query, setQuery] = useState("");
  const [openEntry, setOpenEntry] = useState<string | null>(null);
  const [openTutorial, setOpenTutorial] = useState<string | null>(null);
  const results = useMemo(() => searchHelp(query), [query]);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-bold font-display text-lg mb-1">Help &amp; Tutorials</h2>
        <p className="text-sm text-foreground/70 mb-3">
          Search the guide below, or follow a step-by-step tutorial to get started.
        </p>
        <input
          type="search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpenEntry(null); }}
          placeholder="Search the guide… (e.g. product, color, inventory, checkout)"
          className="w-full max-w-xl px-4 py-2 rounded-xl border border-primary/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none text-sm"
        />
      </div>

      {/* Tutorials */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground/60 mb-2">Tutorials</h3>
        <div className="space-y-2">
          {TUTORIALS.map((t) => (
            <div key={t.id} className="bg-warm-sand/30 rounded-xl">
              <button
                onClick={() => setOpenTutorial(openTutorial === t.id ? null : t.id)}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
              >
                <span className="text-sm font-medium text-primary">{t.title}</span>
                <span className="text-xs text-foreground/50">{openTutorial === t.id ? "−" : "+"}</span>
              </button>
              {openTutorial === t.id && (
                <div className="px-4 pb-4 border-t border-warm-sand pt-3">
                  <p className="text-xs text-foreground/70 mb-3">{t.description}</p>
                  <ol className="space-y-2">
                    {t.steps.map((s, i) => (
                      <li key={i} className="flex gap-2.5">
                        <span className="shrink-0 w-5 h-5 rounded-full bg-gold/20 text-gold-ink flex items-center justify-center text-xs font-bold">
                          {i + 1}
                        </span>
                        <span className="text-sm text-foreground/80">
                          <span className="font-medium text-primary">{s.title}.</span> {s.body}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Guide */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground/60 mb-2">
          Guide {query && `· ${results.length} result${results.length === 1 ? "" : "s"}`}
        </h3>
        {results.length === 0 ? (
          <p className="text-sm text-foreground/70">No guide entries match “{query}”. Try “product”, “color”, “inventory”, or “admin”.</p>
        ) : (
          <div className="space-y-2">
            {results.map((e) => (
              <div key={e.id} className="bg-white border border-warm-sand rounded-xl">
                <button
                  onClick={() => setOpenEntry(openEntry === e.id ? null : e.id)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <span className="text-sm font-medium text-primary">{e.title}</span>
                  <span className="text-xs text-foreground/50">{openEntry === e.id ? "−" : "+"}</span>
                </button>
                {openEntry === e.id && (
                  <div className="px-4 pb-4 border-t border-warm-sand pt-3 space-y-3">
                    <span className="inline-block px-2 py-0.5 bg-warm-sand rounded-full text-[10px] text-foreground/60 uppercase tracking-wide">
                      {e.category}
                    </span>
                    <div className="text-sm text-foreground/80 whitespace-pre-line">{e.body}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
