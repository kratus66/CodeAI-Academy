function globMatch(pattern: string, text: string): boolean {
  let p = 0;
  let t = 0;
  let star = -1;
  let mark = 0;
  while (t < text.length) {
    const current = pattern[p];
    if (p < pattern.length && (current === "?" || current === text[t])) {
      p += 1;
      t += 1;
    } else if (p < pattern.length && current === "*") {
      star = p;
      mark = t;
      p += 1;
    } else if (star !== -1) {
      p = star + 1;
      mark += 1;
      t = mark;
    } else {
      return false;
    }
  }
  while (p < pattern.length && pattern[p] === "*") {
    p += 1;
  }
  return p === pattern.length;
}

export function matchesAction(pattern: string, action: string): boolean {
  return globMatch(pattern.toLowerCase(), action.toLowerCase());
}

export function matchesResource(pattern: string, arn: string): boolean {
  return globMatch(pattern, arn);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function stringList(value: unknown): string[] | null {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value) && value.every((item): item is string => typeof item === "string")) {
    return value;
  }
  return null;
}
