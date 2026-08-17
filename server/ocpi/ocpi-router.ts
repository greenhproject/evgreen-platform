import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getPlatformSettings, upsertPlatformSettings } from "../db";
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
  });
}
