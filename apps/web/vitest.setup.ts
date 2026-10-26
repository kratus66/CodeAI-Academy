import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// `globals: false` desactiva el auto-cleanup de Testing Library, así que se registra aquí.
afterEach(() => {
  cleanup();
});
