import { cn } from "@/lib/cn";

const SIZE = 56;
const STROKE = 6;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface ProgressRingProps {
  /** Avance de 0 a 100; se acota al rango del contrato. */
  readonly value: number;
  /** Nombre accesible: «Avance de la etapa 3», «Avance de U0.1.1»… */
  readonly label: string;
  readonly className?: string;
}

/**
 * Anillo de avance con el porcentaje en el centro. El color nunca es el único
 * canal: el `role="progressbar"` expone el valor a la tecnología asistiva y el
 * texto visible lo repite para quien no distingue el trazo.
 */
export function ProgressRing({ value, label, className }: ProgressRingProps) {
  const pct = Math.min(100, Math.max(0, value));
  const dashOffset = CIRCUMFERENCE * (1 - pct / 100);

  return (
    <span
      role="progressbar"
      aria-label={label}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={`${pct} %`}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center",
        className,
      )}
    >
      <svg
        aria-hidden="true"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="h-14 w-14 -rotate-90"
      >
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          className="stroke-white/10"
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          className="stroke-accent transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <span
        aria-hidden="true"
        className="absolute text-xs font-semibold text-white"
      >
        {pct} %
      </span>
    </span>
  );
}
