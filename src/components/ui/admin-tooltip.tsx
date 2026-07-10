"use client";

import { useState, type ReactNode } from "react";

interface TooltipProps {
  /** Content shown in the tooltip popup */
  content: string;
  /** Optional: only show tooltip until dismissed */
  dismissKey?: string;
  children: ReactNode;
  /** Position relative to children */
  side?: "top" | "bottom" | "right";
}

export default function AdminTooltip({ content, dismissKey, children, side = "top" }: TooltipProps) {
  const storageKey = dismissKey ? `tooltip-dismissed-${dismissKey}` : null;
  const [dismissed, setDismissed] = useState(() => {
    if (!storageKey) return false;
    try { return localStorage.getItem(storageKey) === "1"; } catch { return false; }
  });
  const [visible, setVisible] = useState(false);

  const handleDismiss = () => {
    setDismissed(true);
    setVisible(false);
    if (storageKey) {
      try { localStorage.setItem(storageKey, "1"); } catch {}
    }
  };

  if (dismissed) return <>{children}</>;

  const positionClasses =
    side === "bottom" ? "top-full mt-2" :
    side === "right" ? "left-full ml-2 top-0" :
    "bottom-full mb-2";

  return (
    <div className="relative inline-flex items-center gap-1">
      {children}
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        onBlur={() => setTimeout(() => setVisible(false), 200)}
        className="w-4 h-4 rounded-full bg-gold/20 text-gold flex items-center justify-center text-[10px] font-bold hover:bg-gold/40 transition-colors shrink-0"
        title="Help"
      >
        ?
      </button>
      {visible && (
        <div className={`absolute z-50 ${positionClasses} w-64 p-3 bg-white border border-warm-sand rounded-xl shadow-lg text-xs text-primary/70 leading-relaxed`}>
          <p>{content}</p>
          {dismissKey && (
            <button
              onClick={handleDismiss}
              className="mt-2 text-[10px] text-gold hover:text-gold-light"
            >
              Got it, don&apos;t show again
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Display count of dismissed tooltips — placed at top of admin page */
export function DismissedTooltipsCount() {
  const [count, setCount] = useState(0);
  // Count is informational — reset clears all
  if (typeof window !== "undefined" && count === 0) {
    try {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith("tooltip-dismissed-"));
      if (keys.length > 0 && count !== keys.length) {
        setTimeout(() => setCount(keys.length), 0);
      }
    } catch {}
  }

  const resetAll = () => {
    try {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith("tooltip-dismissed-"));
      keys.forEach((k) => localStorage.removeItem(k));
      setCount(0);
    } catch {}
  };

  if (count === 0) return null;
  return (
    <div className="text-center mb-6">
      <button onClick={resetAll} className="text-xs text-primary/30 hover:text-primary/60 underline">
        Reset {count} dismissed tooltips
      </button>
    </div>
  );
}
