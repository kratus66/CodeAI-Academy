import { PieceIcon } from "./PieceIcon";

/** Indicador de espera decorativo: tres piezas que caen en cadena. */
export function TetrisLoader() {
  return (
    <span aria-hidden className="inline-flex items-end gap-1.5">
      {(["T", "L", "S"] as const).map((id, index) => (
        <PieceIcon
          key={id}
          id={id}
          className="h-3.5 w-auto animate-piece-fall"
          style={{ animationDelay: `${index * 220}ms` }}
        />
      ))}
    </span>
  );
}
