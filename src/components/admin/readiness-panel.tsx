"use client";

/**
 * Launch readiness — which products are fit to show, and a controlled way to
 * unlist the rest.
 *
 * The rule lives in `src/lib/product-readiness.ts` and is shared with the report
 * script, so what this panel previews is what the analysis says. Nothing is
 * written until the operator reads the list and confirms; every write is then
 * confirmed against the server, because a cache-resolved write is the one way a
 * bulk hide can silently do nothing (Known Issue #61).
 */
import { useMemo, useState } from "react";
import { collection, deleteField, doc, getDocsFromServer, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ManagedProduct } from "@/types";
import {
  assessProduct,
  blockersFor,
  summarise,
  type ReadinessIssue,
  type ReadinessMode,
} from "@/lib/product-readiness";

const ISSUE_LABELS: Record<ReadinessIssue, string> = {
  inactive: "already unlisted",
  "no-price": "no sellable price",
  "no-image": "no photo",
  "thin-description": "little or no description",
  "design-record-price": "$1 design record",
  "duplicate-name": "duplicate-looking name",
  "out-of-stock": "out of stock",
  "price-anomaly": "implausible size surcharge",
  "no-category": "no category",
  "no-variants": "no variants",
};

export default function ReadinessPanel({
  products,
  onChanged,
}: {
  products: ManagedProduct[];
  onChanged: () => void;
}) {
  const [mode, setMode] = useState<ReadinessMode>("strict");
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const summary = useMemo(() => summarise(products, mode), [products, mode]);
  // Show what the OTHER rule would leave, because the difference is the whole
  // decision: strict hides a product for a missing photo, which can empty a shop
  // that has not been photographed yet.
  const strictSummary = useMemo(() => summarise(products, "strict"), [products]);
  const blockingSummary = useMemo(() => summarise(products, "blocking-only"), [products]);

  const toUnlist = useMemo(
    () =>
      products
        .filter((p) => p.active !== false)
        .map((p) => ({ product: p, result: assessProduct(p) }))
        .filter(({ result }) => blockersFor(result, mode).length > 0),
    [products, mode],
  );

  // Restore is by PROVENANCE, never by readiness: only products this tool hid are
  // eligible. Publishing "everything that now passes the rule" would also revive
  // products someone archived deliberately — which is exactly how the catalogue
  // went from 231 live to 16 on 2026-11-18.
  const toolHidden = useMemo(
    () => products.filter((p) => p.active === false && Boolean(p.launchHiddenAt)),
    [products],
  );

  // One-off: the 2026-11-18 strict unlist happened before provenance was
  // recorded. These are the products it hid, identified by that write's
  // timestamp bucket. Shown only while they exist, and labelled as what it is.
  const LEGACY_UNLIST_PREFIX = "2026-11-18T17:3";
  const legacyHidden = useMemo(
    () =>
      products.filter(
        (p) =>
          p.active === false &&
          !p.launchHiddenAt &&
          (p.updatedAt ?? "").startsWith(LEGACY_UNLIST_PREFIX),
      ),
    [products],
  );

  const apply = async (targets: ManagedProduct[], active: boolean, legacy = false) => {
    if (!targets.length) return;
    const verb = active ? "Restore" : "Unlist";
    if (
      !window.confirm(
        `${verb} ${targets.length} product${targets.length === 1 ? "" : "s"}?` +
          (active ? " Only products this tool hid are restored." : " This is reversible with the Restore button."),
      )
    ) {
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const now = new Date().toISOString();
      for (const p of targets) {
        await setDoc(
          doc(db, "products", p.id),
          active
            ? { active: true, launchHiddenAt: deleteField(), updatedAt: now }
            : { active: false, launchHiddenAt: now, updatedAt: now },
          { merge: true },
        );
      }
      // Confirm against the server rather than trusting the local cache.
      const snap = await getDocsFromServer(collection(db, "products"));
      const wanted = new Set(targets.map((p) => p.id));
      const wrong = snap.docs.filter((d) => wanted.has(d.id) && d.data().active !== active).length;
      setNote(
        wrong === 0
          ? `${targets.length} product${targets.length === 1 ? "" : "s"} ${active ? "restored" : "unlisted"}${legacy ? " (pre-tracking batch)" : ""} — confirmed by the server.`
          : `${targets.length - wrong} of ${targets.length} confirmed; ${wrong} did not stick. Check your connection and retry.`,
      );
      onChanged();
    } catch (err) {
      setNote("Failed: " + (err instanceof Error ? err.message : "unknown error"));
    } finally {
      setBusy(false);
    }
  };

  const breakdown = Object.entries(summary.byIssue)
    .filter(([issue]) => issue !== "inactive")
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  return (
    <section className="bg-white border border-warm-sand rounded-2xl p-5 mb-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="font-bold font-display">Launch readiness</h3>
          <p className="text-xs text-foreground/80 mt-1 max-w-xl">
            Which products are safe to show. Unlisted products stay editable here and can be
            republished the moment their data is fixed.
          </p>
        </div>
        <label className="text-xs text-foreground/80 flex items-center gap-2">
          Rule
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as ReadinessMode)}
            className="px-2 py-1.5 rounded-lg border border-primary/20 bg-white text-xs"
          >
            <option value="strict">Strict — photo, copy, price, stock</option>
            <option value="blocking-only">Hard blockers only — ignore photo/copy</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-4 mt-4 text-sm">
        <span><strong>{summary.active}</strong> listed</span>
        <span className="text-green-700"><strong>{summary.ready}</strong> ready</span>
        <span className="text-danger"><strong>{summary.toUnlist}</strong> to unlist</span>
        <span className="text-foreground/70"><strong>{summary.total - summary.active}</strong> already unlisted</span>
      </div>

      <p className="text-[11px] text-foreground/70 mt-1">
        Strict rule would leave <strong>{strictSummary.ready}</strong> listed; hard-blockers only would leave{" "}
        <strong>{blockingSummary.ready}</strong>. Choose the rule that matches how much of the catalogue is ready.
      </p>

      {breakdown.length > 0 && (
        <p className="text-[11px] text-foreground/70 mt-2">
          {breakdown.map(([issue, n]) => `${ISSUE_LABELS[issue as ReadinessIssue] ?? issue} ${n}`).join(" · ")}
        </p>
      )}

      <div className="flex flex-wrap gap-2 mt-4">
        <button
          type="button"
          onClick={() => setPreview((v) => !v)}
          className="px-3 py-1.5 rounded-lg border border-primary/20 text-xs font-medium hover:bg-warm-sand/50 transition-colors"
        >
          {preview ? "Hide list" : `Preview ${toUnlist.length} to unlist`}
        </button>
        <button
          type="button"
          disabled={busy || toUnlist.length === 0}
          onClick={() => apply(toUnlist.map((t) => t.product), false)}
          className="px-3 py-1.5 rounded-lg bg-danger/10 text-danger text-xs font-medium disabled:opacity-40"
        >
          {busy ? "Working…" : `Unlist ${toUnlist.length}`}
        </button>
        <button
          type="button"
          disabled={busy || toolHidden.length === 0}
          onClick={() => apply(toolHidden, true)}
          className="px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-medium disabled:opacity-40"
        >
          {busy ? "Working…" : `Restore ${toolHidden.length} hidden by this tool`}
        </button>
        {legacyHidden.length > 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={() => apply(legacyHidden, true, true)}
            className="px-3 py-1.5 rounded-lg bg-gold/15 text-gold-deep text-xs font-medium disabled:opacity-40"
            title="Products hidden by the strict unlist on 18 Nov, before this tool started recording provenance."
          >
            Restore the {legacyHidden.length} hidden on 18 Nov
          </button>
        )}
      </div>

      {note && <p className="text-xs mt-3 text-foreground/80">{note}</p>}

      {preview && (
        <div className="mt-4 max-h-72 overflow-auto border border-warm-sand rounded-xl divide-y divide-warm-sand">
          {toUnlist.length === 0 && <p className="p-3 text-xs text-foreground/70">Nothing to unlist under this rule.</p>}
          {toUnlist.map(({ product, result }) => (
            <div key={product.id} className="p-2.5 text-xs flex justify-between gap-3">
              <span className="font-medium truncate">{product.name}</span>
              <span className="text-foreground/70 shrink-0 text-right">
                {blockersFor(result, mode).map((b) => ISSUE_LABELS[b] ?? b).join(", ")}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
