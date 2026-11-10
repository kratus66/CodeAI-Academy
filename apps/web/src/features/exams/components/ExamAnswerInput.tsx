"use client";

import type { QuizSubmissionInput } from "@codeai/shared";
import { useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/cn";

/**
 * Controles de respuesta de la sala de examen (S15, H5).
 *
 * Solo capturan la respuesta: no hay botón «Comprobar», ni texto de acierto o
 * fallo, ni explicaciones. El componente es controlado: `value` es la respuesta
 * guardada y cada cambio se anuncia por `onChange` para que la sala lo guarde
 * con `PUT /exams/attempts/:id/items/:position`.
 *
 * Las cuatro formas de `config` son las de `banco-ejercicios.md` §3.2, y un
 * `config` sin `kind` es `single`. Las respuestas a medias (una casilla de dos,
 * una pareja suelta) se quedan en el borrador del control y se anuncian como
 * `null`, porque el servidor solo guarda respuestas completas.
 */

const CHOICE =
  "flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm text-slate-200 transition";

const CHOICE_CHECKED = "border-accent bg-accent/10";

const CHOICE_IDLE = "border-line/70 bg-ink-card/40 hover:border-white/30";

const ROW =
  "flex flex-wrap items-center gap-3 rounded-xl border border-line/70 bg-ink-card/40 px-4 py-3 text-sm text-slate-200";

const MOVE_BUTTON =
  "rounded-full border border-white/15 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:border-line/60 disabled:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

const SELECT =
  "rounded-full border border-white/15 bg-ink px-3 py-1 text-sm text-slate-200 transition hover:border-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

const EMPTY_OPTION_LABEL = "Elige…";

const UNAVAILABLE_MESSAGE = "Este tipo de pregunta todavía no está disponible.";

const SELECT_COUNT_HINT: Record<2 | 3, string> = {
  2: "Selecciona DOS",
  3: "Selecciona TRES",
};

export interface ExamAnswerInputProps {
  readonly config: Record<string, unknown>;
  readonly statement: string;
  readonly value: QuizSubmissionInput | null;
  readonly onChange: (next: QuizSubmissionInput | null) => void;
  readonly disabled?: boolean;
}

interface ExamElement {
  readonly id: string;
  readonly text: string;
}

type ExamAnswerConfig =
  | { readonly kind: "single"; readonly options: readonly ExamElement[] }
  | {
      readonly kind: "multiple";
      readonly selectCount: 2 | 3;
      readonly options: readonly ExamElement[];
    }
  | { readonly kind: "ordering"; readonly items: readonly ExamElement[] }
  | {
      readonly kind: "matching";
      readonly left: readonly ExamElement[];
      readonly right: readonly ExamElement[];
    };

/**
 * Elementos pintables de una lista del `config`. Una entrada sin `id` o sin
 * `text` se descarta: es la misma tolerancia que ya usan los reproductores del
 * laboratorio con una configuración mal formada.
 */
function readElements(raw: unknown): ExamElement[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.flatMap((element: unknown) => {
    const record =
      typeof element === "object" && element !== null
        ? (element as Record<string, unknown>)
        : {};

    return typeof record.id === "string" && typeof record.text === "string"
      ? [{ id: record.id, text: record.text }]
      : [];
  });
}

/**
 * Configuración mínima que se puede pintar. Devuelve `null` cuando el `kind` no
 * es ninguno de los cuatro del contrato o cuando faltan las piezas que el
 * control necesita; en ambos casos se anuncia en lugar de pintar un control
 * incompleto que guardaría una respuesta inválida.
 */
function readConfig(config: Record<string, unknown>): ExamAnswerConfig | null {
  const kind = typeof config.kind === "string" ? config.kind : "single";

  if (kind === "single") {
    const options = readElements(config.options);

    return options.length === 0 ? null : { kind, options };
  }

  if (kind === "multiple") {
    const selectCount = config.selectCount;

    if (selectCount !== 2 && selectCount !== 3) {
      return null;
    }

    const options = readElements(config.options);

    return options.length < selectCount ? null : { kind, selectCount, options };
  }

  if (kind === "ordering") {
    const items = readElements(config.items);

    return items.length < 2 ? null : { kind, items };
  }

  if (kind === "matching") {
    const left = readElements(config.left);
    const right = readElements(config.right);

    return left.length === 0 || left.length !== right.length
      ? null
      : { kind, left, right };
  }

  return null;
}

/**
 * Orden que se pinta: la respuesta guardada si es un orden de estos elementos y,
 * si no, el orden del `config`, que a propósito no es el correcto.
 */
function readOrder(
  items: readonly ExamElement[],
  value: QuizSubmissionInput | null,
): string[] {
  const ids = items.map((item) => item.id);
  const saved = value?.order;

  if (saved === undefined) {
    return ids;
  }

  const known = saved.filter((id) => ids.includes(id));
  const rest = ids.filter((id) => !known.includes(id));

  return [...known, ...rest];
}

interface AnswerDraft<T> {
  readonly draft: T;
  readonly commit: (next: T, answer: QuizSubmissionInput | null) => void;
}

/**
 * Borrador de una respuesta que se arma en varios pasos. El estado vive en el
 * control porque `value` solo transporta respuestas completas: si la sala
 * recibiera `null` en cada paso, la casilla recién marcada se borraría sola.
 * Se resincroniza cuando llega un `value` distinto del último anunciado, que es
 * lo que pasa al retomar una respuesta guardada o al descartarla.
 */
function useAnswerDraft<T>(
  value: QuizSubmissionInput | null,
  fromValue: T,
): AnswerDraft<T> {
  const [draft, setDraft] = useState<T>(fromValue);
  const announced = useRef<QuizSubmissionInput | null>(value);

  useEffect(() => {
    if (value === announced.current) {
      return;
    }

    announced.current = value;
    setDraft(fromValue);
  }, [value, fromValue]);

  function commit(next: T, answer: QuizSubmissionInput | null): void {
    announced.current = answer;
    setDraft(next);
  }

  return { draft, commit };
}

interface VariantProps {
  readonly statement: string;
  readonly value: QuizSubmissionInput | null;
  readonly onChange: (next: QuizSubmissionInput | null) => void;
  readonly disabled: boolean;
}

function OptionText({ id, text }: { readonly id: string; readonly text: string }) {
  return (
    <span>
      <span className="mr-2 font-mono text-xs uppercase text-slate-500">{id}</span>
      {text}
    </span>
  );
}

interface SingleAnswerProps extends VariantProps {
  readonly options: readonly ExamElement[];
  readonly groupName: string;
}

function SingleAnswer({
  statement,
  options,
  value,
  onChange,
  disabled,
  groupName,
}: SingleAnswerProps) {
  const selected = value?.optionId ?? null;

  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="text-base font-medium text-white">{statement}</legend>

      {options.map((option) => {
        const checked = selected === option.id;

        return (
          <label
            key={option.id}
            className={cn(CHOICE, checked ? CHOICE_CHECKED : CHOICE_IDLE)}
          >
            <input
              type="radio"
              name={groupName}
              value={option.id}
              checked={checked}
              onChange={() => onChange({ optionId: option.id })}
              className="mt-1"
            />
            <OptionText id={option.id} text={option.text} />
          </label>
        );
      })}
    </fieldset>
  );
}

interface MultipleAnswerProps extends VariantProps {
  readonly selectCount: 2 | 3;
  readonly options: readonly ExamElement[];
}

function MultipleAnswer({
  statement,
  selectCount,
  options,
  value,
  onChange,
  disabled,
}: MultipleAnswerProps) {
  const { draft: selectedIds, commit } = useAnswerDraft(
    value,
    value?.optionIds ?? [],
  );

  function toggle(optionId: string): void {
    const next = selectedIds.includes(optionId)
      ? selectedIds.filter((id) => id !== optionId)
      : [...selectedIds, optionId];
    const answer: QuizSubmissionInput | null =
      next.length === selectCount ? { optionIds: next } : null;

    commit(next, answer);
    onChange(answer);
  }

  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="text-base font-medium text-white">{statement}</legend>
      <p className="text-sm text-slate-300">{SELECT_COUNT_HINT[selectCount]}</p>

      {options.map((option) => {
        const checked = selectedIds.includes(option.id);
        const atLimit = !checked && selectedIds.length >= selectCount;

        return (
          <label
            key={option.id}
            className={cn(CHOICE, checked ? CHOICE_CHECKED : CHOICE_IDLE)}
          >
            <input
              type="checkbox"
              value={option.id}
              checked={checked}
              disabled={disabled || atLimit}
              onChange={() => toggle(option.id)}
              className="mt-1"
            />
            <OptionText id={option.id} text={option.text} />
          </label>
        );
      })}
    </fieldset>
  );
}

interface OrderingAnswerProps extends VariantProps {
  readonly items: readonly ExamElement[];
}

function OrderingAnswer({
  statement,
  items,
  value,
  onChange,
  disabled,
}: OrderingAnswerProps) {
  const { draft: order, commit } = useAnswerDraft(value, readOrder(items, value));
  const textOf = new Map(items.map((item) => [item.id, item.text]));

  function move(index: number, offset: -1 | 1): void {
    const next = [...order];
    const current = next[index];
    const other = next[index + offset];

    if (current === undefined || other === undefined) {
      return;
    }

    next[index] = other;
    next[index + offset] = current;

    const answer: QuizSubmissionInput = { order: next };

    commit(next, answer);
    onChange(answer);
  }

  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="text-base font-medium text-white">{statement}</legend>

      <ol className="list-none space-y-3 p-0">
        {order.map((itemId, index) => {
          const text = textOf.get(itemId) ?? "";

          return (
            <li key={itemId} className={ROW}>
              <span className="font-mono text-xs text-slate-500">{index + 1}</span>
              <span className="flex-1">{text}</span>
              <span className="flex shrink-0 gap-2">
                <button
                  type="button"
                  aria-label={`Subir: ${text}`}
                  disabled={disabled || index === 0}
                  onClick={() => move(index, -1)}
                  className={MOVE_BUTTON}
                >
                  Subir
                </button>
                <button
                  type="button"
                  aria-label={`Bajar: ${text}`}
                  disabled={disabled || index === order.length - 1}
                  onClick={() => move(index, 1)}
                  className={MOVE_BUTTON}
                >
                  Bajar
                </button>
              </span>
            </li>
          );
        })}
      </ol>
    </fieldset>
  );
}

interface MatchingAnswerProps extends VariantProps {
  readonly left: readonly ExamElement[];
  readonly right: readonly ExamElement[];
}

function MatchingAnswer({
  statement,
  left,
  right,
  value,
  onChange,
  disabled,
}: MatchingAnswerProps) {
  const { draft: pairs, commit } = useAnswerDraft(value, value?.pairs ?? {});
  const taken = new Set(Object.values(pairs));

  function choose(leftId: string, rightId: string): void {
    const next: Record<string, string> = { ...pairs };

    if (rightId === "") {
      delete next[leftId];
    } else {
      next[leftId] = rightId;
    }

    const complete = left.every((element) => {
      const pair = next[element.id];

      return typeof pair === "string" && pair !== "";
    });
    const answer: QuizSubmissionInput | null = complete ? { pairs: next } : null;

    commit(next, answer);
    onChange(answer);
  }

  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="text-base font-medium text-white">{statement}</legend>

      <ul className="list-none space-y-3 p-0">
        {left.map((element) => {
          const selected = pairs[element.id];

          return (
            <li key={element.id} className={ROW}>
              <span className="flex-1">{element.text}</span>
              <select
                aria-label={`Pareja de ${element.text}`}
                value={selected ?? ""}
                onChange={(event) => choose(element.id, event.target.value)}
                className={SELECT}
              >
                <option value="">{EMPTY_OPTION_LABEL}</option>
                {right.map((option) => (
                  <option
                    key={option.id}
                    value={option.id}
                    disabled={option.id !== selected && taken.has(option.id)}
                  >
                    {option.text}
                  </option>
                ))}
              </select>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

/**
 * Controles de respuesta sin corrección: pinta la variante que declara el
 * `config` y anuncia cada cambio con la respuesta completa o `null`. Un `kind`
 * que la sala todavía no sabe pintar no se disfraza de otro tipo.
 */
export function ExamAnswerInput({
  config,
  statement,
  value,
  onChange,
  disabled = false,
}: ExamAnswerInputProps) {
  const groupName = useId();
  const parsed = readConfig(config);

  if (parsed === null) {
    return (
      <p role="alert" className="text-sm text-rose-200">
        {UNAVAILABLE_MESSAGE}
      </p>
    );
  }

  if (parsed.kind === "single") {
    return (
      <SingleAnswer
        statement={statement}
        options={parsed.options}
        value={value}
        onChange={onChange}
        disabled={disabled}
        groupName={groupName}
      />
    );
  }

  if (parsed.kind === "multiple") {
    return (
      <MultipleAnswer
        statement={statement}
        selectCount={parsed.selectCount}
        options={parsed.options}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
    );
  }

  if (parsed.kind === "ordering") {
    return (
      <OrderingAnswer
        statement={statement}
        items={parsed.items}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
    );
  }

  return (
    <MatchingAnswer
      statement={statement}
      left={parsed.left}
      right={parsed.right}
      value={value}
      onChange={onChange}
      disabled={disabled}
    />
  );
}

