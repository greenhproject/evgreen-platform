import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, desc, eq, inArray } from "drizzle-orm";
import { chargingStations, evses, ocpiSyncRuns, organizations } from "../../drizzle/schema";
import { getDb, getPlatformSettings, upsertPlatformSettings } from "../db";
import { getOcpiEligibility, mapStationToOcpiLocation } from "./ocpi-catalog";
import { decryptOcpiSecret, encryptOcpiSecret, isSafeOcpiVersionsUrl, maskOcpiSecret } from "./ocpi-secrets";

const modulesSchema = z.array(z.enum(["LOCATIONS", "TARIFFS", "SESSIONS", "CDRS"])).min(1).max(4);
const configSchema = z.object({
  environment: z.enum(["SANDBOX", "PRODUCTION"]),
  enabled: z.boolean(),
  autoSync: z.boolean(),
  versionsUrl: z.string().trim().optional(),
  countryCode: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/),
  partyId: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{3}$/).optional(),
  modules: modulesSchema,
  token: z.string().optional(),
  mtlsCertificate: z.string().optional(),
  mtlsPrivateKey: z.string().optional(),
});

export function getOcpiActivationError(input: { enabled: boolean; versionsUrl?: string; partyId?: string; token?: string }, hasStoredToken: boolean): string | null {
  if (input.versionsUrl && !isSafeOcpiVersionsUrl(input.versionsUrl)) {
    return "La URL de Versions debe ser HTTPS y no puede apuntar a una red privada.";
  }
  const hasToken = Boolean(input.token?.trim() || hasStoredToken);
  if (input.enabled && (!input.versionsUrl || !input.partyId || !hasToken)) {
    return "Para activar OCPI se requiere Versions URL, Party ID y token oficial de CargaME.";
  }
  return null;
}

export function getOcpiManualPublishDecision(config: { enabled?: boolean; versionsUrl?: string; tokenEncrypted?: string }): { status: "SKIPPED" | "PENDING"; externalRequest: false; message: string } {
  if (!config.enabled || !config.versionsUrl || !config.tokenEncrypted) {
    return { status: "SKIPPED", externalRequest: false, message: "OCPI no está activado o faltan credenciales. No se envió tráfico externo." };
  }
  return { status: "PENDING", externalRequest: false, message: "Catálogo validado en modo dry-run. La publicación externa se habilitará tras la certificación oficial de CargaME." };
}

export function buildOcpiRouter(router: any, adminProcedure: any) {
  return router({
    getConfig: adminProcedure.query(async () => {
      const settings: any = await getPlatformSettings();
      return {
        provider: "CARGAME" as const,
        environment: settings?.ocpiEnvironment ?? "SANDBOX",
        enabled: Boolean(settings?.ocpiEnabled),
        autoSync: Boolean(settings?.ocpiAutoSync),
        versionsUrl: settings?.ocpiVersionsUrl ?? "",
        countryCode: settings?.ocpiCountryCode ?? "CO",
        partyId: settings?.ocpiPartyId ?? "",
        modules: Array.isArray(settings?.ocpiModules) ? settings.ocpiModules : ["LOCATIONS", "TARIFFS"],
        token: maskOcpiSecret(settings?.ocpiTokenEncrypted),
        hasToken: Boolean(settings?.ocpiTokenEncrypted),
        hasMtlsCertificate: Boolean(settings?.ocpiMtlsCertEncrypted),
        hasMtlsPrivateKey: Boolean(settings?.ocpiMtlsKeyEncrypted),
        lastTestAt: settings?.ocpiLastTestAt ?? null,
        lastTestStatus: settings?.ocpiLastTestStatus ?? "NEVER",
        lastTestMessage: settings?.ocpiLastTestMessage ?? null,
      };
    }),
    saveConfig: adminProcedure.input(configSchema).mutation(async ({ input }: any) => {
      const existing: any = await getPlatformSettings();
      const activationError = getOcpiActivationError(input, Boolean(existing?.ocpiTokenEncrypted));
      if (activationError) throw new TRPCError({ code: "BAD_REQUEST", message: activationError });
      const update: any = {
        ocpiProvider: "CARGAME", ocpiEnvironment: input.environment, ocpiEnabled: input.enabled ? 1 : 0,
        ocpiAutoSync: input.autoSync ? 1 : 0, ocpiVersionsUrl: input.versionsUrl || null,
        ocpiCountryCode: input.countryCode, ocpiPartyId: input.partyId || null, ocpiModules: input.modules,
      };
      if (input.token?.trim()) update.ocpiTokenEncrypted = encryptOcpiSecret(input.token.trim());
      if (input.mtlsCertificate?.trim()) update.ocpiMtlsCertEncrypted = encryptOcpiSecret(input.mtlsCertificate.trim());
      if (input.mtlsPrivateKey?.trim()) update.ocpiMtlsKeyEncrypted = encryptOcpiSecret(input.mtlsPrivateKey.trim());
      await upsertPlatformSettings(update);
      return { success: true };
    }),
    testConnection: adminProcedure.mutation(async () => {
      const settings: any = await getPlatformSettings();
      const now = new Date().toISOString();
      if (!settings?.ocpiVersionsUrl || !settings?.ocpiTokenEncrypted) {
        await upsertPlatformSettings({ ocpiLastTestAt: now, ocpiLastTestStatus: "FAILED", ocpiLastTestMessage: "Faltan Versions URL o token OCPI." } as any);
        return { success: false, message: "Configure Versions URL y token antes de probar." };
      }
      try {
        const token = decryptOcpiSecret(settings.ocpiTokenEncrypted);
        const response = await fetch(settings.ocpiVersionsUrl, { headers: { Authorization: `Token ${token}`, Accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
        const message = response.ok ? `OCPI Versions respondió HTTP ${response.status}.` : `CargaME respondió HTTP ${response.status}.`;
        await upsertPlatformSettings({ ocpiLastTestAt: now, ocpiLastTestStatus: response.ok ? "SUCCESS" : "FAILED", ocpiLastTestMessage: message } as any);
        return { success: response.ok, message };
      } catch (error: any) {
        const message = `No se pudo conectar: ${error.message}`;
        await upsertPlatformSettings({ ocpiLastTestAt: now, ocpiLastTestStatus: "FAILED", ocpiLastTestMessage: message } as any);
        return { success: false, message };
      }
    }),
    getCatalog: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de datos no disponible." });
      const settings: any = await getPlatformSettings();
      const stations = await db.select({
        id: chargingStations.id, name: chargingStations.name, address: chargingStations.address, city: chargingStations.city,
        country: chargingStations.country, latitude: chargingStations.latitude, longitude: chargingStations.longitude, timezone: chargingStations.timezone,
        isActive: chargingStations.isActive, isPublic: chargingStations.isPublic, networkAccessMode: chargingStations.networkAccessMode,
        organizationId: chargingStations.organizationId, organizationStatus: organizations.orgStatus, networkMember: organizations.networkMember,
      }).from(chargingStations).leftJoin(organizations, eq(chargingStations.organizationId, organizations.id)).where(eq(chargingStations.networkAccessMode, "ROAMING"));
      const ids = stations.map(station => station.id);
      const connectors = ids.length ? await db.select().from(evses).where(and(inArray(evses.stationId, ids), eq(evses.isActive, 1))) : [];
      const identity = { countryCode: settings?.ocpiCountryCode || "CO", partyId: settings?.ocpiPartyId || "EVG" };
      const entries = stations.map(station => {
        const eligibility = getOcpiEligibility(station as any);
        const stationEvses = connectors.filter(connector => connector.stationId === station.id);
        return {
          stationId: station.id, stationName: station.name, city: station.city, evseCount: stationEvses.length,
          eligibility, location: eligibility.eligible ? mapStationToOcpiLocation(station as any, stationEvses as any, identity) : null,
        };
      });
      return { identity, entries, eligibleCount: entries.filter(entry => entry.eligibility.eligible).length };
    }),
    previewCatalog: adminProcedure.mutation(async ({ ctx }: any) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de datos no disponible." });
      const stations = await db.select({
        id: chargingStations.id, name: chargingStations.name, address: chargingStations.address, city: chargingStations.city,
        country: chargingStations.country, latitude: chargingStations.latitude, longitude: chargingStations.longitude, timezone: chargingStations.timezone,
        isActive: chargingStations.isActive, isPublic: chargingStations.isPublic, networkAccessMode: chargingStations.networkAccessMode,
        organizationId: chargingStations.organizationId, organizationStatus: organizations.orgStatus, networkMember: organizations.networkMember,
      }).from(chargingStations).leftJoin(organizations, eq(chargingStations.organizationId, organizations.id)).where(eq(chargingStations.networkAccessMode, "ROAMING"));
      const eligible = stations.filter(station => getOcpiEligibility(station as any).eligible);
      const runStatus = eligible.length ? "SUCCESS" as const : "SKIPPED" as const;
      const message = eligible.length ? `Catálogo generado localmente con ${eligible.length} estación(es) elegible(s). No se envió tráfico externo.` : "No hay estaciones ROAMING elegibles para publicar.";
      const [result]: any = await db.insert(ocpiSyncRuns).values({ operation: "CATALOG_PREVIEW", status: runStatus, message, details: { eligibleStationIds: eligible.map(station => station.id), roamingStationCount: stations.length }, createdBy: ctx.user?.id, completedAt: new Date().toISOString() } as any);
      return { success: true, runId: result?.insertId, eligibleCount: eligible.length, message };
    }),
    publishCatalog: adminProcedure.mutation(async ({ ctx }: any) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de datos no disponible." });
      const settings: any = await getPlatformSettings();
      const decision = getOcpiManualPublishDecision({ enabled: Boolean(settings?.ocpiEnabled), versionsUrl: settings?.ocpiVersionsUrl, tokenEncrypted: settings?.ocpiTokenEncrypted });
      const [result]: any = await db.insert(ocpiSyncRuns).values({ operation: "LOCATION_PUBLISH", status: decision.status, message: decision.message, details: { dryRun: true, externalRequest: false }, createdBy: ctx.user?.id, completedAt: decision.status === "SKIPPED" ? new Date().toISOString() : null } as any);
      return { success: true, runId: result?.insertId, dryRun: true, externalRequest: false, message: decision.message };
    }),
    listSyncRuns: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(ocpiSyncRuns).orderBy(desc(ocpiSyncRuns.createdAt)).limit(20);
    }),
  });
}
