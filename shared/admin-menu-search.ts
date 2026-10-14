export type NavigationSearchTarget = {
  label: string;
  path: string;
  keywords?: readonly string[];
};

/**
 * Normaliza etiquetas de navegación para búsqueda inclusiva: ignora mayúsculas,
 * acentos y separadores, para que "ocupacion" encuentre "Ocupación".
 */
export function normalizeNavigationQuery(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-CO")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Exige que todos los términos de búsqueda aparezcan en la etiqueta, ruta o alias.
 * Así se admiten búsquedas cortas ("ocpp") y compuestas ("bonos carbono").
 */
export function matchesNavigationQuery(target: NavigationSearchTarget, query: string): boolean {
  const normalizedQuery = normalizeNavigationQuery(query);
  if (!normalizedQuery) return true;

  const searchableText = normalizeNavigationQuery([
    target.label,
    target.path,
    ...(target.keywords ?? []),
  ].join(" "));

  return normalizedQuery.split(" ").every((term) => searchableText.includes(term));
}
