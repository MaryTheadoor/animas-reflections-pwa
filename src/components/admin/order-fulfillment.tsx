"use client";

import { useEffect, useRef, useState } from "react";
import {
  formatMoney,
  itemLineTotal,
  packingSlipText,
  shippingLines,
  type AdminOrder,
} from "./order-model";

/* ─── Admin → Orders: the fulfilment block ────────────────────────────

   Everything the shop needs to print and ship one order, read from the
   Firestore mirror: the address, each item with its customization note, and a
   packing slip on the clipboard. Before this existed the expanded row held only
   the tracking inputs, so shipping an order meant leaving the app for Square
   (docs/ORDER_FULFILLMENT_AND_SQUARE.md F-01). */

type CopyState = "idle" | "copied" | "failed";

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Permission denied or an insecure context — try the legacy path below.
  }
  try {
    if (typeof document === "undefined") return false;
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-1000px";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
}

export default function OrderFulfillment({ order }: { order: AdminOrder }) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
  }, []);

  const slip = packingSlipText(order);
  const address = shippingLines(order.shipping);
  const items = order.items ?? [];
  const totals = order.totals;

  const copySlip = async () => {
    const copied = await copyToClipboard(slip);
    setCopyState(copied ? "copied" : "failed");
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopyState("idle"), 2500);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Fulfilment</p>
        <button
          onClick={copySlip}
          className="px-3 py-1.5 rounded-lg border border-primary/20 bg-white text-xs font-semibold text-gold-deep hover:border-gold"
        >
          {copyState === "copied" ? "Copied ✓" : "Copy packing slip"}
        </button>
      </div>

      <div>
        <p className="text-xs font-medium text-foreground mb-1">Ship to</p>
        {address.length > 0 ? (
          <p className="text-sm text-foreground leading-snug">
            {address.map((line) => <span key={line} className="block">{line}</span>)}
          </p>
        ) : (
          <p className="text-xs text-foreground/70">No shipping address on this record.</p>
        )}
      </div>

      <div>
        <p className="text-xs font-medium text-foreground mb-1">Items</p>
        {items.length === 0 ? (
          <p className="text-xs text-foreground/70">No items on this record.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item, i) => {
              const lineTotal = itemLineTotal(item);
              return (
                <li key={`${item.name}-${i}`} className="text-sm text-foreground">
                  <div className="flex items-baseline justify-between gap-3">
                    <span>{item.quantity} × {item.name}</span>
                    {lineTotal !== undefined && (
                      <span className="font-mono text-xs text-foreground/80 shrink-0">
                        {formatMoney(lineTotal)}
                        {item.quantity > 1 && (
                          <span className="text-foreground/60"> ({formatMoney(item.price)} ea)</span>
                        )}
                      </span>
                    )}
                  </div>
                  {item.note && (
                    <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed bg-white/80 border border-warm-sand rounded-lg p-2 text-foreground">
                      {item.note}
                    </pre>
                  )}
                  {item.designUrl && (
                    <a
                      href={item.designUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-gold-deep hover:underline break-all"
                    >
                      design file ↗
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {(totals || order.paymentId) && (
        <div className="text-xs text-foreground/80 space-y-0.5">
          {totals?.subtotal !== undefined && (
            <p>Subtotal <span className="font-mono">{formatMoney(totals.subtotal)}</span></p>
          )}
          {totals?.shipping !== undefined && (
            <p>Shipping <span className="font-mono">{formatMoney(totals.shipping)}</span></p>
          )}
          {Boolean(totals?.tax) && (
            <p>Tax <span className="font-mono">{formatMoney(totals?.tax)}</span></p>
          )}
          <p>
            Total <span className="font-mono">{formatMoney(totals?.grandTotal ?? order.total)}</span>
          </p>
          {order.paymentId && (
            <p className="font-mono break-all">
              Payment {order.paymentId}
              {order.paymentStatus && <span className="text-foreground/60"> · {order.paymentStatus}</span>}
            </p>
          )}
        </div>
      )}

      {copyState === "failed" && (
        <div className="space-y-1">
          <p className="text-xs text-danger">
            Clipboard unavailable — select the slip below and copy it manually.
          </p>
          <textarea
            readOnly
            value={slip}
            rows={10}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full font-mono text-[11px] p-2 rounded-lg border border-warm-sand bg-white text-foreground"
          />
        </div>
      )}
    </div>
  );
}
