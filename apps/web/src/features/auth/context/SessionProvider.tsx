"use client";

import type { UserPublic } from "@codeai/shared";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

import { authApi, restoreSession } from "@/lib/api-client";

export type SessionStatus = "loading" | "authenticated" | "anonymous";

export interface SessionContextValue {
  readonly user: UserPublic | null;
  readonly status: SessionStatus;
  readonly setUser: (user: UserPublic | null) => void;
  readonly signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

interface SessionProviderProps {
  readonly children: ReactNode;
}

/**
 * Estado de sesión del cliente. Los tokens no se leen nunca desde JavaScript:
 * la identidad se obtiene de `/auth/me` (con rotación del refresh si caducó).
 */
export function SessionProvider({ children }: SessionProviderProps) {
  const [user, setUserState] = useState<UserPublic | null>(null);
  const [status, setStatus] = useState<SessionStatus>("loading");

  const setUser = useCallback((next: UserPublic | null) => {
    setUserState(next);
    setStatus(next ? "authenticated" : "anonymous");
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    restoreSession(controller.signal)
      .then((next) => {
        if (!controller.signal.aborted) {
          setUser(next);
        }
      })
      .catch(() => {
        // Sin sesión legible (red caída o 5xx) la web sigue siendo navegable.
        if (!controller.signal.aborted) {
          setUser(null);
        }
      });

    return () => {
      controller.abort();
    };
  }, [setUser]);

  const signOut = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // La sesión local se cierra igualmente; el logout del servidor es idempotente.
    } finally {
      setUser(null);
    }
  }, [setUser]);

  const value = useMemo<SessionContextValue>(
    () => ({ user, status, setUser, signOut }),
    [setUser, signOut, status, user],
  );

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error("useSession debe usarse dentro de <SessionProvider>");
  }

  return context;
}
