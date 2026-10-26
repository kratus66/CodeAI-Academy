import type { ReactNode } from "react";

interface AuthLayoutProps {
  readonly children: ReactNode;
}

/** Las pantallas de acceso comparten un `main` propio y no muestran la landing. */
export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <main id="inicio" className="flex flex-1 flex-col">
      {children}
    </main>
  );
}
