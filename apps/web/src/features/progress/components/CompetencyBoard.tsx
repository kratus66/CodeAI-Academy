import type { CompetencyProgress } from "@codeai/shared";

import { TETROMINO_COLORS, TETROMINO_IDS } from "@/lib/tetromino";

const MAX_LEVEL = 4;
const MANDATORY = 10;
const CODES = Array.from({ length: 14 }, (_, index) => `C${index + 1}`);

/** Nivel exigido para egresar: 3 en C1–C9 y 4 en C10. */
function targetLevel(code: string): number | null {
  if (code === "C10") return 4;
  const number = Number(code.slice(1));
  return number >= 1 && number <= 9 ? 3 : null;
}

export interface BoardSummary {
  readonly levels: ReadonlyMap<string, number>;
  /** Niveles (1–4) completos en las diez obligatorias: una "fila" del tablero. */
  readonly completeRows: number;
}

export function summarize(
  competencies: readonly CompetencyProgress[],
): BoardSummary {
  const levels = new Map(CODES.map((code) => [code, 0] as [string, number]));
  for (const entry of competencies) levels.set(entry.code, entry.level);
  const mandatory = CODES.slice(0, MANDATORY).map((code) => levels.get(code) ?? 0);
  return { levels, completeRows: Math.min(...mandatory) };
}

interface CompetencyBoardProps {
  readonly competencies: readonly CompetencyProgress[];
}

/**
 * Tablero de egreso: cada competencia es una columna que se apila con su nivel.
 * Una fila se completa cuando las diez obligatorias llegan a ese nivel; el
 * contorno punteado marca el nivel que exige el egreso.
 */
export function CompetencyBoard({ competencies }: CompetencyBoardProps) {
  const { levels, completeRows } = summarize(competencies);
  const description = CODES.map(
    (code) => `${code} nivel ${levels.get(code) ?? 0}`,
  ).join(", ");

  return (
    <figure className="glass rounded-2xl p-5">
      <div
        role="img"
        aria-label={`Tablero de competencias. ${description}. Filas completas: ${completeRows} de ${MAX_LEVEL}.`}
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${CODES.length}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: MAX_LEVEL }, (_, rowIndex) => {
          const level = MAX_LEVEL - rowIndex;
          const rowComplete = level <= completeRows;
          return CODES.map((code, col) => {
            const reached = (levels.get(code) ?? 0) >= level;
            const piece = TETROMINO_IDS[col % TETROMINO_IDS.length] ?? "T";
            const color = TETROMINO_COLORS[piece];
            const isTarget = !reached && targetLevel(code) === level;
            const optional = col >= MANDATORY;
            return (
              <span
                key={`${code}-${level}`}
                aria-hidden
                className={`aspect-square rounded-md border animate-drop-in ${
                  optional ? "opacity-60" : ""
                } ${isTarget ? "border-dashed" : ""}`}
                style={{
                  animationDelay: `${col * 40 + rowIndex * 30}ms`,
                  borderColor: reached
                    ? `${color}cc`
                    : isTarget
                      ? `${color}80`
                      : "rgba(255,255,255,0.05)",
                  backgroundColor: reached ? `${color}33` : "transparent",
                  boxShadow: reached
                    ? rowComplete && !optional
                      ? `0 0 16px ${color}99`
                      : `0 0 8px ${color}33`
                    : undefined,
                }}
              />
            );
          });
        })}
        {CODES.map((code, col) => (
          <span
            key={code}
            aria-hidden
            className={`text-center font-mono text-[10px] text-slate-500 ${
              col >= MANDATORY ? "opacity-60" : ""
            }`}
          >
            {code}
          </span>
        ))}
      </div>
      <figcaption className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
        <span>
          <span className="font-medium text-white">{completeRows}</span> de{" "}
          {MAX_LEVEL} filas completas en C1–C10
        </span>
        <span>Contorno punteado = nivel exigido para egresar</span>
      </figcaption>
    </figure>
  );
}
