"use client";

import { useRef, useState, useCallback, useEffect, useMemo, type PointerEvent } from "react";
import type { PrintZone } from "@/types";

export interface DesignState {
  /** Top-left X position of design as % of canvas width */
  xPercent: number;
  /** Top-left Y position of design as % of canvas height */
  yPercent: number;
  /** Scale multiplier (1 = 100% of print zone) */
  scale: number;
  /** Rotation in degrees */
  rotation: number;
}

interface CustomizerProps {
  baseImage: string;
  /** Optional garment color tint applied as a blend overlay on the base mockup
   *  (color-variant preview without needing a photo per color). */
  tintColor?: string;
  viewName: string;
  views: { key: string; label: string; baseImage: string; printZone: PrintZone }[];
  activeView: string;
  onViewChange: (key: string) => void;
  designUrl?: string;
  designText?: string;
  textColor: string;
  textFont: string;
  onTextColorChange: (color: string) => void;
  onTextFontChange: (font: string) => void;
  onDesignChange: (state: DesignState) => void;
  designState: DesignState;
  onTextChange: (text?: string) => void;
  /** When true, the text tool is hidden — used for single-design products where
   *  only one design (an image) may be printed per item. */
  hideTextTool?: boolean;
}

interface DragState {
  active: boolean;
  mode: "move" | "resize";
  startX: number;
  startY: number;
  startXPercent: number;
  startYPercent: number;
  startScale: number;
}

/** Returns default design position filling the print zone (scale=1 design = zone size) */
export function defaultDesignPosition(zone: PrintZone): Pick<DesignState, "xPercent" | "yPercent"> {
  return {
    xPercent: zone.x_percent,
    yPercent: zone.y_percent,
  };
}

export default function Customizer({
  baseImage,
  tintColor,
  viewName,
  views,
  activeView,
  onViewChange,
  designUrl,
  designText,
  textColor = "#111827",
  textFont = "var(--font-display)",
  onTextColorChange,
  onTextFontChange,
  onDesignChange,
  designState,
  onTextChange,
  hideTextTool = false,
}: CustomizerProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [drag, setDrag] = useState<DragState>({
    active: false,
    mode: "move",
    startX: 0,
    startY: 0,
    startXPercent: 0,
    startYPercent: 0,
    startScale: 1,
  });

  // Track canvas dimensions via ResizeObserver
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setCanvasSize({ width, height });
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const currentView = views.find((v) => v.key === activeView) ?? views[0];
  const printZone = currentView?.printZone;

  // Clamp design so it cannot be dragged outside the print zone boundary.
  // Accounts for the design's scaled width/height so the entire image stays visible.
  const clampToPrintZone = useCallback(
    (xPercent: number, yPercent: number, scale: number) => {
      if (!printZone) return { xPercent, yPercent };
      const w = printZone.width_percent * scale;
      const h = printZone.height_percent * scale;
      return {
        xPercent: Math.max(printZone.x_percent, Math.min(printZone.x_percent + printZone.width_percent - w, xPercent)),
        yPercent: Math.max(printZone.y_percent, Math.min(printZone.y_percent + printZone.height_percent - h, yPercent)),
      };
    },
    [printZone]
  );

  // Convert pixel deltas to percentage-of-canvas deltas so drag behavior is
  // consistent across viewport sizes (mobile vs desktop).
  const deltaToPercent = useCallback(
    (dx: number, dy: number) => {
      return {
        dxPct: canvasSize.width > 0 ? (dx / canvasSize.width) * 100 : 0,
        dyPct: canvasSize.height > 0 ? (dy / canvasSize.height) * 100 : 0,
      };
    },
    [canvasSize]
  );

  // ── Pointer handlers ──

  const handlePointerDown = useCallback(
    (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      setDrag({
        active: true,
        mode: "move",
        startX: e.clientX,
        startY: e.clientY,
        startXPercent: designState.xPercent,
        startYPercent: designState.yPercent,
        startScale: designState.scale,
      });
    },
    [designState.xPercent, designState.yPercent, designState.scale]
  );

  const handleResizePointerDown = useCallback(
    (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      setDrag({
        active: true,
        mode: "resize",
        startX: e.clientX,
        startY: e.clientY,
        startXPercent: designState.xPercent,
        startYPercent: designState.yPercent,
        startScale: designState.scale,
      });
    },
    [designState.xPercent, designState.yPercent, designState.scale]
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!drag.active) return;

      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      const { dxPct, dyPct } = deltaToPercent(dx, dy);

      if (drag.mode === "resize") {
        // Resize proportionally using diagonal drag distance.
        // Scale range: 0.25x – 3x. Divider of 30 controls resize sensitivity.
        const avgDelta = (dxPct + dyPct) / 2;
        const newScale = Math.max(0.25, Math.min(3, drag.startScale + avgDelta / 30));
        const clamped = clampToPrintZone(drag.startXPercent, drag.startYPercent, newScale);
        onDesignChange({ ...designState, scale: newScale, xPercent: clamped.xPercent, yPercent: clamped.yPercent });
      } else {
        const newXPercent = drag.startXPercent + dxPct;
        const newYPercent = drag.startYPercent + dyPct;
        const clamped = clampToPrintZone(newXPercent, newYPercent, designState.scale);
        onDesignChange({ ...designState, xPercent: clamped.xPercent, yPercent: clamped.yPercent });
      }
    },
    [drag, designState, onDesignChange, deltaToPercent, clampToPrintZone]
  );

  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      if (drag.active) {
        setDrag({ active: false, mode: "move", startX: 0, startY: 0, startXPercent: 0, startYPercent: 0, startScale: 1 });
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      }
    },
    [drag.active]
  );

  // Global pointer up (catch releases outside the canvas)
  useEffect(() => {
    if (!drag.active) return;
    const handleGlobalUp = () => {
      setDrag({ active: false, mode: "move", startX: 0, startY: 0, startXPercent: 0, startYPercent: 0, startScale: 1 });
    };
    window.addEventListener("pointerup", handleGlobalUp);
    return () => window.removeEventListener("pointerup", handleGlobalUp);
  }, [drag.active]);

  // Mouse wheel / trackpad scroll resize: ±3% per tick. Same as resize but finer control.
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.03 : 0.03;
      const newScale = Math.max(0.25, Math.min(3, designState.scale + delta));
      const clamped = clampToPrintZone(designState.xPercent, designState.yPercent, newScale);
      onDesignChange({ ...designState, scale: newScale, xPercent: clamped.xPercent, yPercent: clamped.yPercent });
    },
    [designState, onDesignChange, clampToPrintZone]
  );

  // ── Scale buttons ──

  const handleResizeButton = useCallback(
    (direction: "in" | "out") => {
      const delta = direction === "in" ? 0.05 : -0.05;
      const newScale = Math.max(0.25, Math.min(3, designState.scale + delta));
      const clamped = clampToPrintZone(designState.xPercent, designState.yPercent, newScale);
      onDesignChange({ ...designState, scale: newScale, xPercent: clamped.xPercent, yPercent: clamped.yPercent });
    },
    [designState, onDesignChange, clampToPrintZone]
  );

  // ── Rotate ──

  const handleRotate = useCallback(
    (degrees: number) => {
      const newRotation = ((designState.rotation + degrees) % 360 + 360) % 360;
      onDesignChange({ ...designState, rotation: newRotation });
    },
    [designState, onDesignChange]
  );

  // ── Keyboard reposition ──

  // Arrow keys move the design by 1% of the canvas per press (Shift = 5%),
  // clamped to the print zone so keyboard users can reposition like pointer users.
  const handleOverlayKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
      e.preventDefault();
      e.stopPropagation();
      const step = e.shiftKey ? 5 : 1;
      let { xPercent, yPercent } = designState;
      if (e.key === "ArrowLeft") xPercent -= step;
      if (e.key === "ArrowRight") xPercent += step;
      if (e.key === "ArrowUp") yPercent -= step;
      if (e.key === "ArrowDown") yPercent += step;
      const clamped = clampToPrintZone(xPercent, yPercent, designState.scale);
      onDesignChange({ ...designState, xPercent: clamped.xPercent, yPercent: clamped.yPercent });
    },
    [designState, onDesignChange, clampToPrintZone]
  );

  // ── Overlay style computation ──

  const overlayStyle = useMemo(() => {
    if (!printZone) return undefined;
    const w = printZone.width_percent * designState.scale;
    const h = printZone.height_percent * designState.scale;
    return {
      left: `${designState.xPercent}%`,
      top: `${designState.yPercent}%`,
      width: `${w}%`,
      height: `${h}%`,
      transform: `rotate(${designState.rotation}deg)`,
      touchAction: "none" as const,
    };
  }, [printZone, designState]);

  const hasDesign = !!(designUrl || designText);

  return (
    <div className="space-y-4">
      {/* View Tabs */}
      <div className="flex items-center justify-center gap-2 flex-wrap">
        {views.map((v) => (
          <button
            key={v.key}
            onClick={() => onViewChange(v.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeView === v.key
                ? "bg-primary text-white"
                : "bg-warm-sand text-foreground hover:bg-warm-sand/80"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Canvas Area */}
      <div
        ref={canvasRef}
        className="relative w-full max-w-lg mx-auto bg-white rounded-2xl overflow-hidden shadow-card border border-warm-sand select-none touch-none"
        style={{ touchAction: "none" }}
        onWheel={handleWheel}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={baseImage}
          alt={`${viewName} view`}
          className="w-full h-auto pointer-events-none"
          draggable={false}
        />

        {/* Garment color tint overlay — multiply blend tints the mockup. Works
            best on light/transparent-base mockups (tints the garment, background
            stays neutral). Ignored when a real per-color photo is the base image. */}
        {tintColor && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ backgroundColor: tintColor, mixBlendMode: "multiply" }}
          />
        )}

        {/* Print Zone Guide — spotlight dims everything outside the printable area */}
        {printZone && (
          <div
            className="absolute border-2 border-dashed border-gold/60 rounded-lg pointer-events-none"
            style={{
              left: `${printZone.x_percent}%`,
              top: `${printZone.y_percent}%`,
              width: `${printZone.width_percent}%`,
              height: `${printZone.height_percent}%`,
              // Spotlight: huge outer shadow dims everything outside the zone so the
              // printable area stands out clearly against the rest of the garment.
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.18)",
            }}
          >
            <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] text-gold whitespace-nowrap bg-cream/90 px-1.5 py-0.5 rounded-full">
              Print Area
            </span>
          </div>
        )}

        {/* Draggable Design Overlay */}
        {overlayStyle && hasDesign && (
          <div
            className={`absolute group ${drag.active && drag.mode === "move" ? "cursor-grabbing" : "cursor-grab"}`}
            style={{
              ...overlayStyle,
              transformOrigin: "center center",
            }}
            tabIndex={0}
            aria-label="Design position. Use arrow keys to move, Shift plus arrow keys for larger steps"
            onKeyDown={handleOverlayKeyDown}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            {/* Design content */}
            <div className="relative w-full h-full overflow-hidden rounded-sm ring-1 ring-white/60 ring-offset-1">
              {designUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={designUrl}
                  alt="Custom design"
                  className="w-full h-full object-contain mix-blend-multiply opacity-90 pointer-events-none"
                  draggable={false}
                />
              )}
              {designText && !designUrl && (
                <div
                  className="w-full h-full flex items-center justify-center text-center pointer-events-none px-1"
                  style={{
                    fontFamily: textFont,
                    color: textColor,
                    fontSize: `${Math.max(12, 14 / designState.scale)}px`,
                  }}
                >
                  {designText}
                </div>
              )}

              {/* Resize handle (bottom-right corner) */}
              <div
                className="absolute -bottom-3 -right-3 w-7 h-7 bg-white border-2 border-gold rounded-full flex items-center justify-center cursor-nwse-resize opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-gold/10 z-10"
                onPointerDown={handleResizePointerDown}
                title="Drag to resize"
              >
                <svg className="w-3.5 h-3.5 text-gold" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22 22H20V20H22V22ZM22 18H20V16H22V18ZM18 22H16V20H18V22ZM22 14H20V12H22V14ZM18 18H16V16H18V18ZM14 22H12V20H14V22Z" />
                </svg>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Design Controls */}
      <div className="max-w-lg mx-auto space-y-4">
        {!hasDesign && (
          <p className="text-sm text-foreground/80 text-center">
            Upload an image or add text to start customizing. Then drag, resize, and rotate your design — or focus the design and use arrow keys to reposition.
          </p>
        )}

        {/* Scale Controls */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-primary w-12">Size</span>
          <button
            onClick={() => handleResizeButton("out")}
            className="w-8 h-8 rounded-lg bg-warm-sand hover:bg-warm-sand/80 flex items-center justify-center text-primary transition-colors"
            title="Smaller"
            aria-label="Decrease size"
          >
            −
          </button>
          <input
            type="range"
            min={25}
            max={300}
            value={Math.round(designState.scale * 100)}
            onChange={(e) => {
              const newScale = Math.max(0.25, Math.min(3, parseInt(e.target.value) / 100));
              const clamped = clampToPrintZone(designState.xPercent, designState.yPercent, newScale);
              onDesignChange({ ...designState, scale: newScale, xPercent: clamped.xPercent, yPercent: clamped.yPercent });
            }}
            className="flex-1 accent-gold h-1"
            aria-label="Design scale"
          />
          <button
            onClick={() => handleResizeButton("in")}
            className="w-8 h-8 rounded-lg bg-warm-sand hover:bg-warm-sand/80 flex items-center justify-center text-primary transition-colors"
            title="Larger"
            aria-label="Increase size"
          >
            +
          </button>
          <span className="text-xs text-foreground/80 w-10 text-right tabular-nums">
            {Math.round(designState.scale * 100)}%
          </span>
        </div>

        {/* Rotate Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-primary w-12">Rotate</span>
          <button
            onClick={() => handleRotate(-90)}
            className="px-3 py-1.5 text-xs rounded-lg bg-warm-sand hover:bg-warm-sand/80 text-primary transition-colors"
            aria-label="Rotate -90 degrees"
          >
            ↺ 90°
          </button>
          <button
            onClick={() => handleRotate(-15)}
            className="px-3 py-1.5 text-xs rounded-lg bg-warm-sand hover:bg-warm-sand/80 text-primary transition-colors"
            aria-label="Rotate -15 degrees"
          >
            ↺ 15°
          </button>
          <button
            onClick={() => handleRotate(-1)}
            className="px-3 py-1.5 text-xs rounded-lg bg-warm-sand hover:bg-warm-sand/80 text-primary transition-colors"
            aria-label="Rotate -1 degree"
          >
            ↺ 1°
          </button>
          <button
            onClick={() => handleRotate(1)}
            className="px-3 py-1.5 text-xs rounded-lg bg-warm-sand hover:bg-warm-sand/80 text-primary transition-colors"
            aria-label="Rotate +1 degree"
          >
            1° ↻
          </button>
          <button
            onClick={() => handleRotate(15)}
            className="px-3 py-1.5 text-xs rounded-lg bg-warm-sand hover:bg-warm-sand/80 text-primary transition-colors"
            aria-label="Rotate +15 degrees"
          >
            15° ↻
          </button>
          <button
            onClick={() => handleRotate(90)}
            className="px-3 py-1.5 text-xs rounded-lg bg-warm-sand hover:bg-warm-sand/80 text-primary transition-colors"
            aria-label="Rotate +90 degrees"
          >
            90° ↻
          </button>
          <span className="text-xs text-foreground/80 ml-auto tabular-nums">
            {designState.rotation}°
          </span>
        </div>

        {/* Text Input — hidden for single-design products (image only) */}
        {!hideTextTool && (
        <div>
          <label className="block text-sm font-medium text-primary mb-1">
            Name / Number
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={designText ?? ""}
              onChange={(e) => onTextChange(e.target.value || undefined)}
              placeholder="e.g. SMITH 42"
              className="flex-1 px-4 py-2 rounded-xl border border-primary/20 bg-white focus:border-gold focus:ring-1 focus:ring-gold outline-none text-primary transition-colors"
            />
            <input
              type="color"
              value={textColor}
              onChange={(e) => onTextColorChange(e.target.value)}
              className="w-10 h-10 rounded-lg border border-primary/20 cursor-pointer shrink-0"
              title="Text color"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-foreground/80 w-8">Font</span>
            <select
              value={textFont}
              onChange={(e) => onTextFontChange(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-lg border border-primary/20 bg-white text-xs text-primary focus:border-gold focus:ring-1 focus:ring-gold outline-none"
            >
              <option value="var(--font-display)">Serif (Vesper Libre)</option>
              <option value="Arial, sans-serif">Arial</option>
              <option value="Georgia, serif">Georgia</option>
              <option value="'Courier New', monospace">Courier New</option>
              <option value="'Times New Roman', serif">Times New Roman</option>
              <option value="Impact, sans-serif">Impact</option>
              <option value="'Comic Sans MS', cursive">Comic Sans</option>
            </select>
          </div>
          <p className="text-[10px] text-foreground/70 mt-1">
            Drag the design to reposition, or focus it and use arrow keys (Shift for bigger steps). Scroll or use size controls to resize.
          </p>
        </div>
        )}
      </div>
    </div>
  );
}
