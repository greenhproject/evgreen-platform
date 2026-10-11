import { describe } from "vitest";

/**
 * Las pruebas que mutan datos operativos sólo pueden ejecutarse contra una
 * base aislada, nunca contra el DATABASE_URL de la aplicación. En este
 * proyecto el runner de Vitest puede compartir variables de entorno con el
 * servidor de desarrollo, por lo que la ausencia de TEST_DATABASE_URL debe
 * ser un bloqueo seguro, no un permiso implícito para escribir en producción.
 */
export function hasIsolatedTestDatabase(
  environment: Record<string, string | undefined> = process.env,
): boolean {
  if (environment.VITEST !== "true") return false;

  const applicationUrl = environment.DATABASE_URL?.trim();
  const testUrl = environment.TEST_DATABASE_URL?.trim();

  return Boolean(testUrl && applicationUrl && testUrl !== applicationUrl);
}

/**
 * Equivalente a describe para pruebas de integración que escriben en BD.
 * Sin TEST_DATABASE_URL aislada, Vitest las marca como omitidas en vez de
 * generar registros de prueba en el entorno operativo.
 */
export const describeDatabaseIntegration = hasIsolatedTestDatabase()
  ? describe
  : describe.skip;
