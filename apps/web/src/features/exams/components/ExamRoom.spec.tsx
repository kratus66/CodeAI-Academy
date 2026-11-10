import type {
  ExamAttempt,
  ExamAttemptItem,
  ExamResult,
  UpdateExamItemInput,
} from "@codeai/shared";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";

import { ExamRoom } from "./ExamRoom";
import type { ExamRoomApi } from "./ExamRoom";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mocks.replace,
    push: mocks.push,
    refresh: mocks.refresh,
  }),
}));

const RESULT_PATH = "/learn/exams/attempts/att_1/result";

const OPTIONS = [
  { id: "a", text: "Amazon EC2" },
  { id: "b", text: "Amazon S3" },
  { id: "c", text: "Amazon RDS" },
];

function statementFor(position: number): string {
  return `Enunciado de la pregunta ${position}`;
}

function attemptItem(
  position: number,
  overrides: Partial<Omit<ExamAttemptItem, "position">> = {},
): ExamAttemptItem {
  return {
    position,
    domain: 1,
    statement: statementFor(position),
    config: { options: OPTIONS },
    answer: null,
    flagged: false,
    ...overrides,
  };
}

function attempt(overrides: Partial<ExamAttempt> = {}): ExamAttempt {
  return {
    id: "att_1",
    certification: "SAA-C03",
    mode: "form-a",
    domain: null,
    extraTime: false,
    status: "in-progress",
    orientative: false,
    startedAt: "2026-11-09T10:00:00.000Z",
    deadlineAt: "2026-11-09T12:20:00.000Z",
    submittedAt: null,
    remainingSeconds: 300,
    questionCount: 3,
    answeredCount: 0,
    items: [attemptItem(1), attemptItem(2), attemptItem(3)],
    ...overrides,
  };
}

const RESULT: ExamResult = {
  attemptId: "att_1",
  certification: "SAA-C03",
  mode: "form-a",
  domain: null,
  status: "submitted",
  orientative: false,
  startedAt: "2026-11-09T10:00:00.000Z",
  submittedAt: "2026-11-09T11:30:00.000Z",
  correctCount: 2,
  questionCount: 3,
  scorePct: 67,
  domains: [{ domain: 1, name: "Diseño seguro", correct: 2, total: 3, pct: 67 }],
  items: [],
};

/** El servidor devuelve el ítem guardado, así que la respuesta de prueba lo refleja. */
function mergeItem(item: ExamAttemptItem, body: UpdateExamItemInput): ExamAttemptItem {
  return {
    ...item,
    answer: body.answer === undefined ? item.answer : body.answer,
    flagged: body.flagged ?? item.flagged,
  };
}

interface ApiOverrides {
  readonly attempt?: ExamAttempt;
  readonly updateItem?: ExamRoomApi["updateItem"];
  readonly submit?: ExamRoomApi["submit"];
}

function createApi(overrides: ApiOverrides = {}) {
  const loaded = overrides.attempt ?? attempt();
  const get = vi.fn((): Promise<ExamAttempt> => Promise.resolve(loaded));
  const updateItem = vi.fn<ExamRoomApi["updateItem"]>((_attemptId, position, body) =>
    Promise.resolve({
      item: mergeItem(attemptItem(position), body),
      remainingSeconds: 120,
    }),
  );
  const submit = vi.fn((): Promise<ExamResult> => Promise.resolve(RESULT));

  const api: ExamRoomApi = {
    get,
    updateItem: overrides.updateItem ?? updateItem,
    submit: overrides.submit ?? submit,
  };

  return { api, get, updateItem, submit };
}

beforeEach(() => {
  mocks.replace.mockReset();
  mocks.push.mockReset();
  mocks.refresh.mockReset();
});

describe("ExamRoom", () => {

  it("muestra una pregunta a la vez y avanza con «Siguiente»", async () => {
    const { api } = createApi();

    render(<ExamRoom attemptId="att_1" api={api} />);

    expect(await screen.findByText("Pregunta 1 de 3")).toBeInTheDocument();
    expect(screen.getByText("Enunciado de la pregunta 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));

    expect(screen.getByText("Pregunta 2 de 3")).toBeInTheDocument();
    expect(screen.getByText("Enunciado de la pregunta 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Anterior" })).toBeEnabled();
  });

  it("guarda la respuesta elegida y la refleja en la cuadrícula", async () => {
    const { api, updateItem } = createApi();

    render(<ExamRoom attemptId="att_1" api={api} />);

    fireEvent.click(await screen.findByRole("radio", { name: /Amazon S3/ }));

    await waitFor(() =>
      expect(updateItem).toHaveBeenCalledWith("att_1", 1, { answer: { optionId: "b" } }),
    );
    expect(
      screen.getByRole("button", { name: "Pregunta 1: respondida" }),
    ).toBeInTheDocument();
  });

  it("marca la pregunta para revisar", async () => {
    const { api, updateItem } = createApi();

    render(<ExamRoom attemptId="att_1" api={api} />);

    fireEvent.click(await screen.findByLabelText("Marcar para revisar"));

    await waitFor(() =>
      expect(updateItem).toHaveBeenCalledWith("att_1", 1, { flagged: true }),
    );
    expect(
      screen.getByRole("button", { name: "Pregunta 1: sin responder, marcada" }),
    ).toBeInTheDocument();
  });

  it("resincroniza el cronómetro con los segundos que devuelve el servidor", async () => {
    const { api } = createApi();

    render(<ExamRoom attemptId="att_1" api={api} />);

    expect(await screen.findByRole("timer")).toHaveTextContent("00:05:00");

    fireEvent.click(screen.getByRole("radio", { name: /Amazon EC2/ }));

    await waitFor(() =>
      expect(screen.getByRole("timer")).toHaveTextContent("00:02:00"),
    );
  });

  it("avisa del error de red y conserva la respuesta local", async () => {
    const { api } = createApi({
      updateItem: () => Promise.reject(new Error("Sin conexión")),
    });

    render(<ExamRoom attemptId="att_1" api={api} />);

    fireEvent.click(await screen.findByRole("radio", { name: /Amazon S3/ }));

    const alert = await screen.findByRole("alert");

    expect(alert).toHaveTextContent("No pudimos guardar tu respuesta");
    expect(screen.getByRole("radio", { name: /Amazon S3/ })).toBeChecked();
    expect(
      within(alert).getByRole("button", { name: "Reintentar guardado" }),
    ).toBeInTheDocument();
  });


  it("lista las sin responder y las marcadas antes de entregar", async () => {
    const { api } = createApi({
      attempt: attempt({
        items: [
          attemptItem(1, { answer: { optionId: "b" } }),
          attemptItem(2),
          attemptItem(3, { flagged: true }),
        ],
      }),
    });

    render(<ExamRoom attemptId="att_1" api={api} />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Revisar y entregar" }),
    );

    const unanswered = screen.getByRole("list", { name: "Preguntas sin responder" });
    const flagged = screen.getByRole("list", { name: "Preguntas marcadas" });

    expect(
      within(unanswered).getByRole("button", { name: "Pregunta 2" }),
    ).toBeInTheDocument();
    expect(within(flagged).getByRole("button", { name: "Pregunta 3" })).toBeInTheDocument();
    expect(within(unanswered).queryByRole("button", { name: "Pregunta 1" })).toBeNull();
  });

  it("entrega una sola vez tras confirmar y navega al resultado", async () => {
    const { api, submit } = createApi();

    render(<ExamRoom attemptId="att_1" api={api} />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Revisar y entregar" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Entregar simulacro" }));

    expect(
      screen.getByText("Quedan 3 preguntas sin responder. ¿Entregar el simulacro?"),
    ).toBeInTheDocument();

    const confirm = screen.getByRole("button", { name: "Sí, entregar" });

    fireEvent.click(confirm);
    fireEvent.click(confirm);

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(mocks.replace).toHaveBeenCalledWith(RESULT_PATH);
  });

  it("al vencer el tiempo muestra el aviso y navega sin llamar a submit", async () => {
    const { api, submit } = createApi({ attempt: attempt({ remainingSeconds: 0 }) });

    render(<ExamRoom attemptId="att_1" api={api} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Se acabó el tiempo: tu simulacro se entregó",
    );
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith(RESULT_PATH));
    expect(submit).not.toHaveBeenCalled();
  });

  it("trata un 409 al guardar como tiempo agotado", async () => {
    const { api, submit } = createApi({
      updateItem: () =>
        Promise.reject(
          new ApiError({
            status: 409,
            code: "CONFLICT",
            message: "El intento ya no está en curso",
          }),
        ),
    });

    render(<ExamRoom attemptId="att_1" api={api} />);

    fireEvent.click(await screen.findByRole("radio", { name: /Amazon S3/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Se acabó el tiempo: tu simulacro se entregó",
    );
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith(RESULT_PATH));
    expect(submit).not.toHaveBeenCalled();
  });

  it("redirige al resultado si el intento ya no está en curso", async () => {
    const { api, get } = createApi({
      attempt: attempt({ status: "submitted", submittedAt: "2026-11-09T11:30:00.000Z" }),
    });

    render(<ExamRoom attemptId="att_1" api={api} />);

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith(RESULT_PATH));
    expect(get).toHaveBeenCalledWith("att_1");
    expect(screen.queryByRole("radio")).toBeNull();
  });

  it("avisa antes de salir mientras el intento está en curso", async () => {
    const { api } = createApi();

    const { unmount } = render(<ExamRoom attemptId="att_1" api={api} />);

    await screen.findByRole("timer");

    const leaving = new Event("beforeunload", { cancelable: true });

    window.dispatchEvent(leaving);

    expect(leaving.defaultPrevented).toBe(true);

    unmount();

    const afterUnmount = new Event("beforeunload", { cancelable: true });

    window.dispatchEvent(afterUnmount);

    expect(afterUnmount.defaultPrevented).toBe(false);
  });
});

