"use client";

import { useRef, useState, useCallback, useEffect, type PointerEvent } from "react";
import Image from "next/image";
import type { PrintZone } from "@/types";

export interface DesignState {
  xPercent: number;
  yPercent: number;
  scale: number;
  rotation: number;
}

interface CustomizerProps {
  baseImage: string;
  viewName: string;
  views: { key: string; label: string; baseImage: string; printZone: PrintZone }[];
  activeView: string;
  onViewChange: (key: string) => void;
  designUrl?: string;
  designText?: string;
  textColor?: string;
  textFont?: string;
  onDesignChange: (state: DesignState) => void;
  designState: DesignState;
  onTextChange: (text?: string) => void;
}

interface DragState {
  dragging: boolean;
  startX: number;
  startY: number;
  startXPercent: number;
  startYPercent: number;
}

export default function Customizer({
  baseImage,
  viewName,
  views,
  activeView,
  onViewChange,
  designUrl,
  designText,
  textColor = "#111827",
  textFont = "var(--font-display)",
  onDesignChange,
  designState,
  onTextChange,
}: CustomizerProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [drag, setDrag] = useState<DragState>({
    dragging: false,
    startX: 0,
    startY: 0,
    startXPercent: 0,
    startYPercent: 0,
  });
  const [resizing, setResizing] = useState(false);

  // Track canvas dimensions
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

  // Convert pixels to percent
  const toPercent = useCallback(
    (pixels: number, dimension: "width" | "height") => {
      const size = dimension === "width" ? canvasSize.width : canvasSize.height;
      if (size === 0) return 0;
      return (pixels / size) * 100;
    },
    [canvasSize]
  );

  // Drag handlers
  const handlePointerDown = useCallback(
    (e: PointerEvent) => {
      if (resizing) return;
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      setDrag({
        dragging: true,
        startX: e.clientX,
        startY: e.clientY,
        startXPercent: designState.xPercent,
        startYPercent: designState.yPercent,
      });
    },
    [resizing, designState.xPercent, designState.yPercent]
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!drag.dragging) return;

      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;

      const newXPercent = drag.startXPercent + toPercent(dx, "width");
      const newYPercent = drag.startYPercent + toPercent(dy, "height");

      onDesignChange({
        ...designState,
        xPercent: newXPercent,
        yPercent: newYPercent,
      });
    },
    [drag, designState, onDesignChange, toPercent]
  );

  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      if (drag.dragging) {
        setDrag({ dragging: false, startX: 0, startY: 0, startXPercent: 0, startYPercent: 0 });
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      }
    },
    [drag.dragging]
  );

  // Resize with wheel
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.02 : 0.02;
      const newScale = Math.max(0.25, Math.min(3, designState.scale + delta));
      onDesignChange({ ...designState, scale: newScale });
    },
    [designState, onDesignChange]
  );

  // Resize buttons
  const handleResizeButton = useCallback(
    (direction: "in" | "out") => {
      const delta = direction === "in" ? 0.05 : -0.05;
      const newScale = Math.max(0.25, Math.min(3, designState.scale + delta));
      onDesignChange({ ...designState, scale: newScale });
    },
    [designState, onDesignChange]
  );

  // Rotate
  const handleRotate = useCallback(
    (degrees: number) => {
      const newRotation = (designState.rotation + degrees) % 360;
      onDesignChange({ ...designState, rotation: newRotation });
    },
    [designState, onDesignChange]
  );

  const currentView = views.find((v) => v.key === activeView) ?? views[0];
  const printZone = currentView?.printZone;

  const overlayStyle = printZone
    ? {
        left: `${printZone.x_percent + (designState.xPercent - printZone.x_percent)}%`,
        top: `${printZone.y_percent + (designState.yPercent - printZone.y_percent)}%`,
        width: `${printZone.width_percent * designState.scale}%`,
        height: `${printZone.height_percent * designState.scale}%`,
        transform: `rotate(${designState.rotation}deg)`,
        touchAction: "none" as const,
      }
    : undefined;

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
                : "bg-warm-sand text-primary/60 hover:bg-warm-sand/80"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Canvas Area */}
      <div
        ref={canvasRef}
        className="relative w-full max-w-lg mx-auto bg-white rounded-2xl overflow-hidden shadow-card border border-warm-sand cursor-default select-none"
        onWheel={handleWheel}
      >
        <Image
          src={baseImage}
          alt={`${viewName} view`}
          width={600}
          height={600}
          className="w-full h-auto pointer-events-none"
          draggable={false}
          priority
        />

        {/* Print Zone Guide (always visible) */}
        {printZone && (
          <div
            className="absolute border-2 border-dashed border-gold/20 rounded-lg pointer-events-none"
            style={{
              left: `${printZone.x_percent}%`,
              top: `${printZone.y_percent}%`,
              width: `${printZone.width_percent}%`,
              height: `${printZone.height_percent}%`,
            }}
          >
            <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] text-gold/40 whitespace-nowrap">
              Print Area
            </span>
          </div>
        )}

        {/* Draggable Design Overlay */}
        {overlayStyle && hasDesign && (
          <div
            className="absolute cursor-grab active:cursor-grabbing group"
            style={{
              ...overlayStyle,
              transformOrigin: "center center",
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            {/* Design content */}
            <div className="relative w-full h-full overflow-hidden rounded-sm">
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

              {/* Resize handle */}
              <div
                className="absolute -bottom-3 -right-3 w-6 h-6 bg-white border-2 border-gold rounded-full flex items-center justify-center cursor-nwse-resize opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setResizing(true);
                }}
                onPointerUp={() => setResizing(false)}
              >
                <svg className="w-3 h-3 text-gold" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22 22H20V20H22V22ZM22 18H20V16H22V18ZM18 22H16V20H18V22ZM22 14H20V12H22V14ZM18 18H16V16H18V18ZM14 22H12V20H14V22Z" />
                </svg>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Design Controls */}
      <div className="max-w-lg mx-auto space-y-4">
        {/* Scale Controls */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-primary w-12">Size</span>
          <button
            onClick={() => handleResizeButton("out")}
            className="w-8 h-8 rounded-lg bg-warm-sand hover:bg-warm-sand/80 flex items-center justify-center text-primary transition-colors"
            title="Smaller"
          >
            −
          </button>
          <input
            type="range"
            min={25}
            max={300}
            value={Math.round(designState.scale * 100)}
            onChange={(e) =>
              onDesignChange({ ...designState, scale: parseInt(e.target.value) / 100 })
            }
            className="flex-1 accent-gold h-1"
          />
          <button
            onClick={() => handleResizeButton("in")}
            className="w-8 h-8 rounded-lg bg-warm-sand hover:bg-warm-sand/80 flex items-center justify-center text-primary transition-colors"
            title="Larger"
          >
            +
          </button>
          <span className="text-xs text-primary/40 w-10 text-right">
            {Math.round(designState.scale * 100)}%
          </span>
        </div>

        {/* Rotate Controls */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-primary w-12">Rotate</span>
          <button
            onClick={() => handleRotate(-90)}
            className="px-3 py-1.5 text-xs rounded-lg bg-warm-sand hover:bg-warm-sand/80 text-primary transition-colors"
          >
            ↺ 90°
          </button>
          <button
            onClick={() => handleRotate(-15)}
            className="px-3 py-1.5 text-xs rounded-lg bg-warm-sand hover:bg-warm-sand/80 text-primary transition-colors"
          >
            ↺ 15°
          </button>
          <button
            onClick={() => handleRotate(15)}
            className="px-3 py-1.5 text-xs rounded-lg bg-warm-sand hover:bg-warm-sand/80 text-primary transition-colors"
          >
            15° ↻
          </button>
          <button
            onClick={() => handleRotate(90)}
            className="px-3 py-1.5 text-xs rounded-lg bg-warm-sand hover:bg-warm-sand/80 text-primary transition-colors"
          >
            90° ↻
          </button>
          <span className="text-xs text-primary/40 ml-auto">
            {designState.rotation}°
          </span>
        </div>

        {/* Text Input */}
        <div>
          <label className="block text-sm font-medium text-primary mb-1">
            Name / Number
          </label>
          <div className="flex gap-2">
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
              onChange={() => {
                // Color is managed by parent
              }}
              className="w-10 h-10 rounded-lg border border-primary/20 cursor-pointer"
              title="Text color"
            />
          </div>
          <p className="text-[10px] text-primary/30 mt-1">
            Drag the design on the canvas to reposition. Scroll or use size controls to resize.
          </p>
        </div>
      </div>
    </div>
  );
}
