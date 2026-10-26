import { cn } from "@/lib/cn";

interface SectionHeadingProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly description?: string;
  readonly className?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  className,
}: SectionHeadingProps) {
  return (
    <div className={cn("max-w-3xl", className)}>
      <p className="flex items-center gap-3 text-xs font-medium uppercase tracking-[0.2em] text-accent">
        <span aria-hidden className="h-px w-8 bg-accent/60" />
        {eyebrow}
      </p>
      <h2 className="mt-5 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 text-base leading-relaxed text-slate-400">
          {description}
        </p>
      ) : null}
    </div>
  );
}
