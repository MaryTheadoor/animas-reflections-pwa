"use client";

export type Density = 2 | 3 | 4 | 5;

// Desktop grid columns per selected tile density. Mobile always stacks to 1 column.
// Shared by the shop and search pages so the product grids stay consistent.
export const DENSITY_CLASSES: Record<Density, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
  5: "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
};

interface DensityPickerProps {
  value: Density;
  onChange: (d: Density) => void;
}

/** Segmented control for choosing how many product tiles show per row. */
export default function DensityPicker({ value, onChange }: DensityPickerProps) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-foreground/80 mr-1 hidden sm:inline">View</span>
      <div className="inline-flex bg-warm-sand/50 rounded-full p-0.5 gap-0.5">
        {([2, 3, 4, 5] as Density[]).map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            title={`Show ${n} per row`}
            aria-label={`Show ${n} tiles per row`}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              value === n ? "bg-primary text-white" : "text-foreground hover:text-primary"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
