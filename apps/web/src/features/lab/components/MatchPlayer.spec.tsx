import type { ExerciseDetail } from "@codeai/shared";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MatchPlayer, autoScrollVelocity } from "./MatchPlayer";
import type { ShuffleCards } from "./MemoryShared";

const PAIRS = [
  { id: "p1", term: "Alcance", definition: "Lo que entra y lo que queda fuera de la tarea" },
  { id: "p2", term: "Pruebas", definition: "Comprobar que lo construido cumple el requisito" },
  { id: "p3", term: "Despliegue", definition: "Llevar el cambio a producción" },
];

function exercise(config: Record<string, unknown> = { mode: "match", pairs: PAIRS }): ExerciseDetail {
  return {
    id: "ex-match",
    unitId: "unit-1",
    unitCode: "U0.1.1",
    type: "MEMORY",
    title: "Une los conceptos",
    ladder: "GUIDED",
    difficulty: 1,
    estimatedMin: 4,
    language: null,
    competencies: ["C1"],
    statement: "Une cada concepto con su definición.",
    config,
    publicTests: [],
    hintsAvailable: 0,
    starterCode: null,
  };
}

/** Deja las definiciones en [d1, d2, d3]; el componente las rota si coinciden con los conceptos. */
const dealInOrder: ShuffleCards = (cards) => [...cards];

const DEF = {
  p1: PAIRS[0]?.definition ?? "",
  p2: PAIRS[1]?.definition ?? "",
  p3: PAIRS[2]?.definition ?? "",
};

function definition(text: string): HTMLElement {
  return within(screen.getByRole("list", { name: "Definiciones disponibles" })).getByRole("button", { name: text });
}

function slot(term: string): HTMLElement {
  return screen.getByRole("button", { name: `Colocar la definición en ${term}` });
}

describe("MatchPlayer", () => {
  it("muestra los conceptos y las definiciones sin repetirlas en el recuadro de introducción", () => {
    render(<MatchPlayer exercise={exercise()} shuffle={dealInOrder} />);

    expect(within(screen.getByRole("list", { name: "Conceptos" })).getAllByRole("listitem")).toHaveLength(3);
    expect(within(screen.getByRole("list", { name: "Definiciones disponibles" })).getAllByRole("listitem")).toHaveLength(3);
    expect(screen.queryByRole("list", { name: "Definiciones a asignar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Conceptos a emparejar" })).not.toBeInTheDocument();
  });

  it("nunca deja las definiciones en el mismo orden que los conceptos", () => {
    render(<MatchPlayer exercise={exercise()} shuffle={dealInOrder} />);

    const order = within(screen.getByRole("list", { name: "Definiciones disponibles" }))
      .getAllByRole("button")
      .map((button) => button.textContent);

    expect(order).not.toEqual([DEF.p1, DEF.p2, DEF.p3]);
  });

  it("tocar una definición y luego su concepto la une y la deja fija en verde", () => {
    render(<MatchPlayer exercise={exercise()} shuffle={dealInOrder} />);

    fireEvent.click(definition(DEF.p2));
    expect(definition(DEF.p2)).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(slot("Pruebas"));

    const united = screen.getByRole("button", { name: `Pruebas: ${DEF.p2}` });

    expect(united).toBeDisabled();
    expect(united.className).toContain("emerald");
    expect(screen.getByRole("status")).toHaveTextContent("Unidos: 1 de 3 · Errores: 0");
    expect(
      within(screen.getByRole("list", { name: "Definiciones disponibles" })).queryByRole("button", { name: DEF.p2 }),
    ).not.toBeInTheDocument();
  });

  it("arrastrar una definición hasta su concepto también la une", () => {
    render(<MatchPlayer exercise={exercise()} shuffle={dealInOrder} />);

    const data = new Map<string, string>();
    const dataTransfer = {
      setData: (type: string, value: string) => data.set(type, value),
      getData: (type: string) => data.get(type) ?? "",
    };

    fireEvent.dragStart(definition(DEF.p1), { dataTransfer });
    fireEvent.dragOver(slot("Alcance"), { dataTransfer });
    fireEvent.drop(slot("Alcance"), { dataTransfer });

    expect(screen.getByRole("button", { name: `Alcance: ${DEF.p1}` })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Unidos: 1 de 3");
  });

  it("una definición en el concepto equivocado se pinta en rojo, cuenta un error y vuelve al grupo", async () => {
    render(<MatchPlayer exercise={exercise()} shuffle={dealInOrder} flipBackMs={30} />);

    fireEvent.click(definition(DEF.p1));
    fireEvent.click(slot("Despliegue"));

    const wrongSlot = screen.getByRole("button", { name: "Colocar la definición en Despliegue" });

    expect(wrongSlot.className).toContain("rose");
    expect(wrongSlot).toHaveTextContent(DEF.p1);
    expect(screen.getByRole("status")).toHaveTextContent("Errores: 1");

    await waitFor(() => expect(wrongSlot).toHaveTextContent("Suelta aquí la definición"));

    expect(wrongSlot.className).not.toContain("rose");
    expect(definition(DEF.p1)).toBeInTheDocument();
  });

  it("mientras se muestra el error no acepta otra colocación", () => {
    render(<MatchPlayer exercise={exercise()} shuffle={dealInOrder} flipBackMs={5000} />);

    fireEvent.click(definition(DEF.p1));
    fireEvent.click(slot("Despliegue"));
    fireEvent.click(definition(DEF.p2));
    fireEvent.click(slot("Pruebas"));

    expect(screen.getByRole("status")).toHaveTextContent("Unidos: 0 de 3 · Errores: 1");
  });

  it("no hay tope de fallos: se puede fallar muchas veces y seguir jugando", async () => {
    render(<MatchPlayer exercise={exercise()} shuffle={dealInOrder} flipBackMs={0} />);

    for (let attempt = 0; attempt < 12; attempt += 1) {
      fireEvent.click(definition(DEF.p1));
      fireEvent.click(slot("Despliegue"));
      await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(`Errores: ${attempt + 1}`));
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Colocar la definición en Despliegue" })).toHaveTextContent(
          "Suelta aquí la definición",
        ),
      );
    }

    expect(screen.queryByText(/Se acabaron/)).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Errores: 12");
  });

  it("al unir todo anuncia el resultado y repasa los conceptos donde se falló", async () => {
    render(<MatchPlayer exercise={exercise()} shuffle={dealInOrder} flipBackMs={0} />);

    fireEvent.click(definition(DEF.p1));
    fireEvent.click(slot("Despliegue"));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Colocar la definición en Despliegue" })).toHaveTextContent(
        "Suelta aquí la definición",
      ),
    );

    for (const [id, term] of [["p1", "Alcance"], ["p2", "Pruebas"], ["p3", "Despliegue"]] as const) {
      fireEvent.click(definition(DEF[id]));
      fireEvent.click(slot(term));
    }

    expect(await screen.findByRole("status")).toHaveTextContent("¡Unido todo! 1 error por el camino.");
    expect(
      within(screen.getByRole("list", { name: "Conceptos para repasar" }))
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Alcance", "Despliegue"]);
  });

  it("sin errores no propone repaso y «Jugar otra vez» reinicia todo", () => {
    render(<MatchPlayer exercise={exercise()} shuffle={dealInOrder} />);

    for (const [id, term] of [["p1", "Alcance"], ["p2", "Pruebas"], ["p3", "Despliegue"]] as const) {
      fireEvent.click(definition(DEF[id]));
      fireEvent.click(slot(term));
    }

    expect(screen.getByRole("status")).toHaveTextContent("¡Unido todo! Sin errores.");
    expect(screen.queryByRole("list", { name: "Conceptos para repasar" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Jugar otra vez" }));

    expect(screen.getByRole("status")).toHaveTextContent("Unidos: 0 de 3 · Errores: 0");
    expect(within(screen.getByRole("list", { name: "Definiciones disponibles" })).getAllByRole("listitem")).toHaveLength(3);
  });

  it("avisa si el ejercicio no trae pares", () => {
    render(<MatchPlayer exercise={exercise({ mode: "match", pairs: [] })} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Este juego no tiene pares disponibles.");
  });

  it("muestra el resumen y las etapas de la introducción cuando existen", () => {
    render(
      <MatchPlayer
        exercise={exercise({
          mode: "match",
          pairs: PAIRS,
          intro: { summary: "Resumen del tema.", list: { title: "Etapas", ordered: true, items: ["Uno", "Dos"] } },
        })}
        shuffle={dealInOrder}
      />,
    );

    const intro = screen.getByRole("region", { name: "Qué vas a repasar" });

    expect(within(intro).getByText("Resumen del tema.")).toBeInTheDocument();
    expect(within(intro).getByText("Etapas")).toBeInTheDocument();
  });
});

describe("MatchPlayer: tablero largo", () => {
  const dataTransfer = () => {
    const data = new Map<string, string>();

    return {
      setData: (type: string, value: string) => data.set(type, value),
      getData: (type: string) => data.get(type) ?? "",
    };
  };

  it("soltar sobre cualquier parte de la fila del concepto basta, no sólo sobre el hueco", () => {
    render(<MatchPlayer exercise={exercise()} shuffle={dealInOrder} />);

    const transfer = dataTransfer();
    const row = screen.getByRole("button", { name: "Colocar la definición en Pruebas" }).closest("li") as HTMLElement;

    fireEvent.dragStart(definition(DEF.p2), { dataTransfer: transfer });
    fireEvent.drop(row, { dataTransfer: transfer });

    expect(screen.getByRole("button", { name: `Pruebas: ${DEF.p2}` })).toBeDisabled();
  });

  it("el grupo de definiciones es un bloque fijo con su propio desplazamiento", () => {
    render(<MatchPlayer exercise={exercise()} shuffle={dealInOrder} />);

    const pool = screen.getByRole("list", { name: "Definiciones disponibles" }).parentElement as HTMLElement;

    expect(pool.className).toContain("md:sticky");
    expect(pool.className).toContain("md:overflow-y-auto");
  });

  it("al arrastrar cerca del borde inferior desplaza la página, y deja de hacerlo al soltar", async () => {
    const scrollBy = vi.spyOn(window, "scrollBy").mockImplementation(() => undefined);

    render(<MatchPlayer exercise={exercise()} shuffle={dealInOrder} />);
    fireEvent.dragStart(definition(DEF.p1), { dataTransfer: dataTransfer() });

    const nearBottom = new Event("dragover", { bubbles: true });
    Object.assign(nearBottom, { clientY: window.innerHeight - 5 });
    document.body.dispatchEvent(nearBottom);

    await waitFor(() => expect(scrollBy).toHaveBeenCalledWith(0, expect.any(Number)));
    expect((scrollBy.mock.calls[0]?.[1] ?? 0) > 0).toBe(true);

    fireEvent.dragEnd(definition(DEF.p1));
    await new Promise((resolve) => setTimeout(resolve, 60));
    scrollBy.mockClear();
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(scrollBy).not.toHaveBeenCalled();
    scrollBy.mockRestore();
  });

  it("no desplaza la página si no se está arrastrando", async () => {
    const scrollBy = vi.spyOn(window, "scrollBy").mockImplementation(() => undefined);

    render(<MatchPlayer exercise={exercise()} shuffle={dealInOrder} />);

    const nearBottom = new Event("dragover", { bubbles: true });
    Object.assign(nearBottom, { clientY: window.innerHeight - 5 });
    document.body.dispatchEvent(nearBottom);
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(scrollBy).not.toHaveBeenCalled();
    scrollBy.mockRestore();
  });

  it("la introducción se puede plegar para dejar sitio al tablero", () => {
    render(
      <MatchPlayer exercise={exercise({ mode: "match", pairs: PAIRS, intro: { summary: "Resumen del tema." } })} shuffle={dealInOrder} />,
    );

    const details = screen.getByRole("region", { name: "Qué vas a repasar" }).querySelector("details");

    expect(details).not.toBeNull();
    expect(details?.open).toBe(true);
  });
});

describe("autoScrollVelocity", () => {
  it("es 0 en la zona central del visor", () => {
    expect(autoScrollVelocity(400, 800)).toBe(0);
  });

  it("baja (positivo) cerca del borde inferior y más rápido cuanto más cerca", () => {
    const near = autoScrollVelocity(700, 800);
    const edge = autoScrollVelocity(795, 800);

    expect(near).toBeGreaterThan(0);
    expect(edge).toBeGreaterThan(near);
  });

  it("sube (negativo) cerca del borde superior, por debajo del menú fijo", () => {
    expect(autoScrollVelocity(150, 800)).toBeLessThan(0);
    expect(autoScrollVelocity(10, 800)).toBeLessThan(autoScrollVelocity(150, 800));
  });

  it("no pasa de la velocidad máxima ni siquiera fuera del visor", () => {
    expect(Math.abs(autoScrollVelocity(-500, 800))).toBeLessThanOrEqual(26);
    expect(autoScrollVelocity(5000, 800)).toBeLessThanOrEqual(26);
  });
});
