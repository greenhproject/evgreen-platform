export function normalizeContractSearch(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-CO")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Busca todos los términos escritos, sin depender de orden, mayúsculas ni acentos.
 * Es deliberadamente local: nunca envía texto de contratos a un servicio externo.
 */
export function matchesContractSearch(query: string, fields: Array<string | number | null | undefined>): boolean {
  const terms = normalizeContractSearch(query).split(" ").filter(Boolean);
  if (!terms.length) return true;

  const document = normalizeContractSearch(fields.filter((field) => field !== null && field !== undefined).join(" "));
  return terms.every((term) => document.includes(term));
}
