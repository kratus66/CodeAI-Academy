import type { UnlockStatus } from "@codeai/shared";

/** Insignia compacta para tarjetas de catálogo. */
export function LockBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-200">
      <span aria-hidden="true">🔒</span>
      Bloqueado
    </span>
  );
}

/** Estado de bloqueo de un elemento; `undefined` equivale a «sin regla» (abierto). */
export function isLocked(unlock: UnlockStatus | undefined): boolean {
  return unlock !== undefined && !unlock.unlocked;
}

interface LockNoticeProps {
  readonly unlock: UnlockStatus;
  /** Qué se bloquea: «Este proyecto», «Esta entrevista»… */
  readonly subject: string;
}

/** Explica por qué algo está cerrado y qué falta para abrirlo. */
export function LockNotice({ unlock, subject }: LockNoticeProps) {
  return (
    <div
      role="status"
      className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-100"
    >
      <p className="font-medium">
        <span aria-hidden="true">🔒 </span>
        {subject} se desbloquea según tu nivel.
      </p>
      {unlock.reason ? <p className="mt-2 text-amber-100/80">{unlock.reason}</p> : null}
    </div>
  );
}
