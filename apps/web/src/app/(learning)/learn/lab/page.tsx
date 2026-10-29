import type { Metadata } from "next";

import { LabHub } from "@/features/lab/components/LabHub";

export const metadata: Metadata = {
  title: "Laboratorio",
  description:
    "Ejercicios de código, cuestionarios, tarjetas y reflexiones de las unidades que ya puedes practicar.",
};

export default function LabPage() {
  return (
    <div className="space-y-8">
      <header className="max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
          Laboratorio
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Practica lo que ya desbloqueaste
        </h1>
        <p className="mt-4 text-base leading-relaxed text-slate-400">
          Cada unidad trae ejercicios de código con pruebas, cuestionarios,
          tarjetas y reflexiones. Una unidad se abre al dominar sus
          prerrequisitos; los proyectos y las entrevistas se desbloquean con
          tu nivel.
        </p>
      </header>

      <LabHub />
    </div>
  );
}
