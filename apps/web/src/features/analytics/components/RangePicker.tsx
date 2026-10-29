"use client";

import type { AnalyticsRange } from "@codeai/shared";
import { cn } from "@/lib/cn";

/** Opciones del selector; `all` no recorta por fecha en la API. */
export const RANGE_OPTIONS: readonly {
  readonly value: AnalyticsRange;
  readonly label: string;
}[] = [
  { value: "7d", label: "7 días" },
  { value: "30d", label: "30 días" },
  { value: "90d", label: "90 días" },
  { value: "all", label: "Todo" },
];

export function rangeLabel(range: AnalyticsRange): string {
  return RANGE_OPTIONS.find((option) => option.value === range)?.label ?? range;
}

interface RangePickerProps {
  readonly value: AnalyticsRange;
  readonly onChange: (range: AnalyticsRange) => void;
}

/** Grupo de botones que fija el periodo pedido a la API (`?range=`). */
export function RangePicker({ value, onChange }: RangePickerProps) {
  return (
    <div
      role="group"
      aria-label="Periodo del análisis"
      className="flex flex-wrap items-center gap-1 rounded-full border border-line/70 bg-ink-card/40 p-1"
    >
      {RANGE_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => {
            onChange(option.value);
          }}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
            option.value === value
              ? "bg-accent/20 text-white"
              : "text-slate-400 hover:text-slate-100",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
