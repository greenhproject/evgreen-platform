import type { Express, Request, Response } from "express";

export const DETAILED_HEALTH_PATH = "/api/health/detailed";

export interface DatabaseCheckResult {
  ok: boolean;
  latencyMs?: number;
  error?: string;
}

export type DatabaseChecker = () => Promise<DatabaseCheckResult>;

/**
 * A diferencia de /api/health (el que Railway consulta para decidir si
 * promueve un despliegue — por eso ese siempre responde 200 mientras el
 * proceso esté vivo, ver railway-startup-healthcheck.test.ts, y no debe
 * tocarse), este endpoint es para monitoreo externo humano: responde 503
 * real cuando la base de datos no responde, para que cualquier herramienta
 * de uptime lo detecte sin necesitar configuración especial de palabra
 * clave en el cuerpo de la respuesta.
 */
export function registerDetailedHealthRoute(app: Express, checkDatabase: DatabaseChecker): void {
  app.get(DETAILED_HEALTH_PATH, async (_req: Request, res: Response) => {
    try {
      const database = await checkDatabase();
      res.status(database.ok ? 200 : 503).json({
        status: database.ok ? "healthy" : "degraded",
        timestamp: new Date().toISOString(),
        checks: { database },
      });
    } catch (error: any) {
      res.status(500).json({
        status: "error",
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });
}

export async function checkDatabaseConnection(): Promise<DatabaseCheckResult> {
  const start = Date.now();
  try {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) {
      return { ok: false, error: "DATABASE_URL no configurado o pool no disponible", latencyMs: Date.now() - start };
    }
    await (db as any).execute("SELECT 1");
    return { ok: true, latencyMs: Date.now() - start };
  } catch (error: any) {
    return { ok: false, error: error.message, latencyMs: Date.now() - start };
  }
}
