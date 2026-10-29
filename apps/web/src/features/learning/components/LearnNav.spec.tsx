import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LearnNav, activeHref } from "./LearnNav";

const pathname = vi.hoisted(() => ({ value: "/learn" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.value,
}));

describe("LearnNav", () => {
  beforeEach(() => {
    pathname.value = "/learn";
  });

  it("marca la sección actual con aria-current", () => {
    pathname.value = "/learn/projects/mi-proyecto";
    render(<LearnNav />);

    expect(screen.getByRole("link", { name: "Proyectos" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Aprender" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("asigna lecciones y etapas a Aprender", () => {
    expect(activeHref("/learn")).toBe("/learn");
    expect(activeHref("/learn/lessons/intro")).toBe("/learn");
    expect(activeHref("/learn/interviews/sessions/1")).toBe("/learn/interviews");
    expect(activeHref("/learn/insights")).toBe("/learn/insights");
    expect(activeHref("/login")).toBeNull();
  });
});
