"use client";

import { loginSchema } from "@codeai/shared";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

import { AuthField } from "@/features/auth/components/AuthField";
import { useSession } from "@/features/auth/context/SessionProvider";
import {
  describeSubmitError,
  fieldErrorsFromIssues,
  withoutField,
} from "@/features/auth/lib/form-errors";
import { authApi } from "@/lib/api-client";

const BUTTON_CLASSES =
  "inline-flex w-full items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold text-ink transition hover:bg-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink-card disabled:cursor-not-allowed disabled:opacity-60";

export function LoginForm() {
  const router = useRouter();
  const { setUser } = useSession();
  const [values, setValues] = useState({ email: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function update(field: "email" | "password", value: string): void {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => withoutField(current, field));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError(null);

    const parsed = loginSchema.safeParse(values);

    if (!parsed.success) {
      setFieldErrors(fieldErrorsFromIssues(parsed.error.issues));
      return;
    }

    setFieldErrors({});
    setPending(true);

    try {
      const user = await authApi.login(parsed.data);

      setUser(user);
      // El shell autenticado llega en S3; hasta entonces se vuelve a la landing.
      router.push("/");
      router.refresh();
    } catch (error) {
      const state = describeSubmitError(error);

      setFieldErrors({ ...state.fieldErrors });
      setFormError(state.formError);
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      noValidate
      aria-busy={pending}
      onSubmit={(event) => void handleSubmit(event)}
      className="space-y-5"
    >
      {formError ? (
        <p
          role="alert"
          className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200"
        >
          {formError}
        </p>
      ) : null}

      <AuthField
        id="email"
        label="Correo electrónico"
        type="email"
        value={values.email}
        onChange={(value) => update("email", value)}
        autoComplete="email"
        error={fieldErrors.email}
        disabled={pending}
      />

      <AuthField
        id="password"
        label="Contraseña"
        type="password"
        value={values.password}
        onChange={(value) => update("password", value)}
        autoComplete="current-password"
        error={fieldErrors.password}
        disabled={pending}
      />

      <button type="submit" disabled={pending} className={BUTTON_CLASSES}>
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
