export function playerDisplayName(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "";
  return trimmed.toLocaleLowerCase("fi-FI").replace(
    /(^|[\s\-‐‑‒–—'’])(\p{L})/gu,
    (_match, boundary: string, initial: string) => boundary + initial.toLocaleUpperCase("fi-FI"),
  );
}
