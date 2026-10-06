"use client";

import { useRef } from "react";

export interface PrintZone {
  x_percent: number;
  y_percent: number;
  width_percent: number;
  height_percent: number;
}

const DEFAULT_ZONE: PrintZone = { x_percent: 30, y_percent: 25, width_percent: 40, height_percent: 50 };

/** Drag/resize a print zone over a product mockup. Percentages map to the preview. */
export default function PrintZoneEditor({
  mockupUrl,
  zone,
  onChange,
  label,
}: {
  mockupUrl?: string;
  zone: PrintZone | undefined;
  onChange: (z: PrintZone) => void;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ type: "move" | "resize" | null; sx: number; sy: number; start: PrintZone }>({
    type: null, sx: 0, sy: 0, start: DEFAULT_ZONE,
  });

  const z = zone ?? DEFAULT_ZONE;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const rect = () => ref.current?.getBoundingClientRect();

  const start = (e: React.PointerEvent, type: "move" | "resize") => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { type, sx: e.clientX, sy: e.clientY, start: { ...z } };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d.type) return;
    const r = rect();
    if (!r) return;
    const dx = ((e.clientX - d.sx) / r.width) * 100;
    const dy = ((e.clientY - d.sy) / r.height) * 100;
    if (d.type === "move") {
      onChange({
        ...d.start,
        x_percent: clamp(d.start.x_percent + dx, 0, 100 - d.start.width_percent),
        y_percent: clamp(d.start.y_percent + dy, 0, 100 - d.start.height_percent),
      });
    } else {
      onChange({
        ...d.start,
        width_percent: clamp(d.start.width_percent + dx, 2, 100 - d.start.x_percent),
        height_percent: clamp(d.start.height_percent + dy, 2, 100 - d.start.y_percent),
      });
    }
  };
  const up = () => { drag.current.type = null; };

  return (
    <div
      ref={ref}
      className="relative w-full aspect-[3/4] bg-warm-sand/20 rounded-xl overflow-hidden border border-primary/15 select-none"
      onPointerMove={move}
      onPointerUp={up}
    >
      {mockupUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote Firebase Storage mockup on a static export; next/image needs a remote loader config.
        <img src={mockupUrl} alt={label} draggable={false} className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-[11px] text-foreground/50 px-2 text-center">
          No mockup image for {label}. Upload one in the Images tab to preview precisely.
        </div>
      )}
      <div
        onPointerDown={(e) => start(e, "move")}
        className="absolute border-2 border-dashed border-gold bg-gold/10 cursor-move"
        style={{ left: `${z.x_percent}%`, top: `${z.y_percent}%`, width: `${z.width_percent}%`, height: `${z.height_percent}%` }}
      >
        <div
          onPointerDown={(e) => { e.stopPropagation(); start(e, "resize"); }}
          className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-gold border-2 border-white rounded-full cursor-nwse-resize"
        />
      </div>
    </div>
  );
}
