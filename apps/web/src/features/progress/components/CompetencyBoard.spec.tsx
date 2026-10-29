import type { CompetencyProgress } from "@codeai/shared";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CompetencyBoard, summarize } from "./CompetencyBoard";

function all(level: number): CompetencyProgress[] {
  return Array.from({ length: 10 }, (_, index) => ({
    code: `C${index + 1}`,
    level,
    evidenceCount: 1,
  })) as CompetencyProgress[];
}

describe("CompetencyBoard", () => {
  it("cuenta como filas completas el nivel mínimo de C1–C10", () => {
    const competencies = all(3).map((entry) =>
      entry.code === "C7" ? { ...entry, level: 1 } : entry,
    ) as CompetencyProgress[];

    expect(summarize(competencies).completeRows).toBe(1);
    expect(summarize([]).completeRows).toBe(0);
  });

  it("ignora la ruta avanzada al contar filas completas", () => {
    const competencies = [
      ...all(2),
      { code: "C12", level: 0, evidenceCount: 0 },
    ] as CompetencyProgress[];

    expect(summarize(competencies).completeRows).toBe(2);
  });

  it("describe el tablero para lectores de pantalla", () => {
    render(<CompetencyBoard competencies={all(3)} />);

    const board = screen.getByRole("img");

    expect(board).toHaveAttribute(
      "aria-label",
      expect.stringContaining("C1 nivel 3"),
    );
    expect(board).toHaveAttribute(
      "aria-label",
      expect.stringContaining("Filas completas: 3 de 4"),
    );
  });
});
