import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

interface ContainerProps {
  readonly children: ReactNode;
  readonly className?: string;
}

export function Container({ children, className }: ContainerProps) {
  return (
    <div className={cn("mx-auto w-full max-w-6xl px-6", className)}>
      {children}
    </div>
  );
}
