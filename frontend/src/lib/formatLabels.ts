export function formatEngineLabel(value?: string | null): string {
  if (!value?.trim()) return "";
  const parts = value.split(/\s*·\s*/).map((part) => part.trim()).filter(Boolean);
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const part of parts) {
    const key = part
      .toLowerCase()
      .replace(/[״"]/g, "")
      .replace(/\s+/g, "")
      .replace(/כס/g, "hp")
      .replace(/בנזין/g, "petrol")
      .replace(/gasoline/g, "petrol");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(part);
  }
  return unique.join(" · ");
}

export function eventHasEnded(start: string, end?: string | null): boolean {
  const close = new Date(end || start);
  return !Number.isNaN(close.getTime()) && close.getTime() < Date.now();
}
