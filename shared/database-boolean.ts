/**
 * Convierte flags provenientes de MySQL/TiDB a un booleano confiable.
 * Dependiendo del driver y del mapeo histórico, un TINYINT puede llegar como
 * `true`, `1`, "1", `false`, `0` o "0". Nunca se debe usar la coerción
 * booleana nativa con "0", porque JavaScript la considera truthy.
 */
export function isEnabledDatabaseFlag(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}
