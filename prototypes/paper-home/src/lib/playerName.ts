export function playerDisplayName(name: string): string {
  const trimmed = name.trim();
  const letters = trimmed.match(/\p{L}/gu) ?? [];
  if (letters.length === 0 || letters.some((letter) => letter !== letter.toLocaleUpperCase("fi-FI"))) return trimmed;

  return trimmed.toLocaleLowerCase("fi-FI").replace(
    /(^|[\s\-‐‑‒–—'’])(\p{L})/gu,
    (_match, boundary: string, initial: string) => boundary + initial.toLocaleUpperCase("fi-FI"),
  );
}
