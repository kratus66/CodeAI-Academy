"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Cronómetro de la sala de examen (S15, T9c).
 *
 * El tiempo lo manda el servidor (§4.0, regla 3): el control cuenta hacia atrás
 * desde `remainingSeconds` y se resincroniza cuando esa prop cambia, pero nunca
 * decide que el intento se acabó. Solo avisa con `onElapsed`, una vez, y la sala
 * confirma el estado contra el servidor.
 *
 * El reloj no lleva `aria-live` porque su texto cambia cada segundo y el lector
 * de pantalla no callaría; los dos avisos de tiempo van por un `role="status"`
 * aparte, que solo aparece en los cinco segundos siguientes a cada umbral.
 */

const TICK_MS = 1_000;
const TEN_MINUTE_HINT = 10 * 60;
const ONE_MINUTE_HINT = 60;
const TEN_MINUTE_TEXT = "Quedan 10 minutos";
const ONE_MINUTE_TEXT = "Queda 1 minuto";
/** Segundos que el aviso permanece visible tras cruzar su umbral. */
const NOTICE_WINDOW_S = 5;

function formatClock(totalSeconds: number): string {
  const remaining = Math.max(0, Math.trunc(totalSeconds));
  const hours = Math.floor(remaining / 3_600);
  const minutes = Math.floor((remaining % 3_600) / 60);
  const seconds = remaining % 60;

  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

/** El aviso se deduce del reloj, así que no hace falta recordar lo ya anunciado. */
function noticeFor(left: number): string | null {
  if (left <= ONE_MINUTE_HINT && left > ONE_MINUTE_HINT - NOTICE_WINDOW_S) {
    return ONE_MINUTE_TEXT;
  }

  if (left <= TEN_MINUTE_HINT && left > TEN_MINUTE_HINT - NOTICE_WINDOW_S) {
    return TEN_MINUTE_TEXT;
  }

  return null;
}

export interface ExamTimerProps {
  readonly remainingSeconds: number;
  readonly onElapsed: () => void;
}

function Countdown({ remainingSeconds, onElapsed }: ExamTimerProps) {
  const [left, setLeft] = useState(remainingSeconds);
  const elapsed = useRef(false);

  useEffect(() => {
    const id = setInterval(() => {
      setLeft((current) => (current > 0 ? current - 1 : 0));
    }, TICK_MS);

    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (left > 0 || elapsed.current) {
      return;
    }

    elapsed.current = true;
    onElapsed();
  }, [left, onElapsed]);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span
        role="timer"
        aria-label="Tiempo restante"
        className="font-mono text-lg font-semibold tabular-nums text-white"
      >
        {formatClock(left)}
      </span>

      <p role="status" className="text-sm font-medium text-amber-200">
        {noticeFor(left)}
      </p>
    </div>
  );
}

/**
 * La `key` es la resincronización: cuando el servidor manda un `remainingSeconds`
 * nuevo, React monta el contador de cero con ese valor, así que el estado no se
 * corrige desde un efecto y el reloj nunca se queda con un valor viejo.
 */
export function ExamTimer({ remainingSeconds, onElapsed }: ExamTimerProps) {
  return (
    <Countdown key={remainingSeconds} remainingSeconds={remainingSeconds} onElapsed={onElapsed} />
  );
}

