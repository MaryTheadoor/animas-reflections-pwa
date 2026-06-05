"use client";

import { useRef, useCallback } from "react";
import Image from "next/image";
import type { PrintZone } from "@/types";

interface CustomizerProps {
  baseImage: string;
  viewName: string;
  printZone: PrintZone;
  designUrl?: string;
  designText?: string;
  onTextChange: (text?: string) => void;
}

export default function Customizer({
  baseImage,
  viewName,
  printZone,
  designUrl,
  designText,
  onTextChange,
}: CustomizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const updateSize = useCallback(() => {
    // Recalculate container dimensions for overlay positioning
    if (containerRef.current) {
      containerRef.current.getBoundingClientRect();
    }
  }, []);

  const overlayStyle = {
    left: `${printZone.x_percent}%`,
    top: `${printZone.y_percent}%`,
    width: `${printZone.width_percent}%`,
    height: `${printZone.height_percent}%`,
  };

  return (
    <div className="space-y-4">
      {/* View Tabs */}
      <div className="text-center">
        <span className="inline-block px-4 py-1 bg-teal text-white text-sm font-medium rounded-full capitalize">
          {viewName} View
        </span>
      </div>

      {/* Canvas Area */}
      <div
        ref={containerRef}
        className="relative w-full max-w-lg mx-auto bg-white rounded-2xl overflow-hidden shadow-card border border-warm-sand"
        onLoad={updateSize}
      >
        <Image
          src={baseImage}
          alt={`${viewName} view`}
          width={600}
          height={600}
          className="w-full h-auto"
          onLoad={updateSize}
        />

        {/* Design Overlay */}
        <div
          className="absolute border-2 border-dashed border-gold/30 rounded-lg pointer-events-none"
          style={overlayStyle}
        >
          {designUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={designUrl}
              alt="Custom design"
              className="w-full h-full object-contain mix-blend-multiply opacity-90"
            />
          )}
          {designText && !designUrl && (
            <div className="w-full h-full flex items-center justify-center text-xl font-bold text-teal/50">
              {designText}
            </div>
          )}
        </div>
      </div>

      {/* Text Input */}
      <div className="max-w-lg mx-auto">
        <label className="block text-sm font-medium text-teal mb-1">
          Name / Number
        </label>
        <input
          type="text"
          value={designText ?? ""}
          onChange={(e) => onTextChange(e.target.value || undefined)}
          placeholder="e.g. SMITH 42"
          className="w-full px-4 py-2 rounded-xl border border-teal/20 bg-white focus:border-gold focus:ring-1 focus:ring-gold outline-none text-teal transition-colors"
        />
      </div>
    </div>
  );
}
