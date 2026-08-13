/**
 * Conversión de timestamps "naive" de MySQL/TiDB (sin marca de zona horaria)
 * a ISO-8601 UTC explícito, para que cualquier cliente (web o nativo, en
 * cualquier país) los interprete correctamente y los muestre en la hora
 * local del dispositivo del usuario.
 *
 * TiDB Cloud guarda CURRENT_TIMESTAMP en UTC pero Drizzle (mode: 'string')
 * lo devuelve como "YYYY-MM-DD HH:MM:SS" sin "Z" ni offset — sin esto, el
 * navegador/WebView interpreta el string como si ya fuera hora local,
 * mostrando la hora UTC cruda en vez de convertirla.
 */
export function toUtcIso(dbTimestamp: string | null | undefined): string | null {
  if (!dbTimestamp) return null;
  return dbTimestamp.replace(" ", "T") + "Z";
}
