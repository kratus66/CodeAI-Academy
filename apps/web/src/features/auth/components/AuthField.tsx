import { cn } from "@/lib/cn";

export interface AuthFieldProps {
  readonly id: string;
  readonly label: string;
  readonly type: "email" | "password" | "text";
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly autoComplete: string;
  readonly hint?: string;
  readonly error?: string;
  readonly disabled?: boolean;
}

const INPUT_CLASSES =
  "w-full rounded-xl border bg-ink/60 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-card disabled:cursor-not-allowed disabled:opacity-60";

/** Campo accesible: etiqueta asociada, ayuda y error anunciados por lector de pantalla. */
export function AuthField({
  id,
  label,
  type,
  value,
  onChange,
  autoComplete,
  hint,
  error,
  disabled = false,
}: AuthFieldProps) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-200">
        {label}
      </label>

      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        required
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          INPUT_CLASSES,
          error
            ? "border-rose-400/60 focus-visible:ring-rose-400"
            : "border-white/10 focus-visible:ring-accent",
        )}
      />

      {hint ? (
        <p id={hintId} className="text-xs leading-relaxed text-slate-500">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-rose-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
