import { Container } from "@/components/layout/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

import { NOT_THIS } from "../data/content";

export function NotThis() {
  return (
    <section id="no-es" className="border-b border-line/60 py-20 sm:py-24">
      <Container>
        <SectionHeading
          eyebrow="Delimitación"
          title="Lo que este programa no es."
          description="Delimitar el producto protege al estudiante de expectativas falsas y protege al programa de promesas que no puede cumplir."
        />

        <ul className="mt-12 grid gap-4 md:grid-cols-2">
          {NOT_THIS.map((item) => (
            <li
              key={item}
              className="flex gap-3 rounded-2xl border border-line bg-ink-soft/50 p-5 text-sm leading-relaxed text-slate-300"
            >
              <span aria-hidden className="mt-0.5 shrink-0 text-rose-400/80">
                ✕
              </span>
              {item}
            </li>
          ))}

          <li className="rounded-2xl border border-mint/30 bg-mint/[0.06] p-5 md:col-span-2">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-mint">
              Sí es
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-200">
              Una formación exigente: proyectos reales, pruebas automatizadas,
              auditoría de código generado y defensa oral de las decisiones
              técnicas.
            </p>
          </li>
        </ul>
      </Container>
    </section>
  );
}
