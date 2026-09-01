import crypto from "crypto";
import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { ocpiRemoteLocations, ocpiSyncRuns } from "../../drizzle/schema";
import { getDb, getPlatformSettings } from "../db";
import { decryptOcpiSecret } from "./ocpi-secrets";

const OCPI_SENSITIVE_KEY = /(?:authorization|password|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|^token$)/i;

function sanitizeOcpiPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeOcpiPayload);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => (
    OCPI_SENSITIVE_KEY.test(key) ? [] : [[key, sanitizeOcpiPayload(child)]]
  )));
}

export function validateOcpiLocation(location: unknown, pathIdentity: { countryCode: string; partyId: string; locationId: string }): string | null {
  if (!location || typeof location !== "object" || Array.isArray(location)) return "El payload debe contener un objeto Location.";
  const value = location as Record<string, unknown>;
  const countryCode = pathIdentity.countryCode.toUpperCase();
  const partyId = pathIdentity.partyId.toUpperCase();
  const requiredText = ["country_code", "party_id", "id", "address", "city", "country", "last_updated"];
  if (requiredText.some(field => typeof value[field] !== "string" || !String(value[field]).trim())) return "Faltan campos obligatorios de Location OCPI.";
  if (!/^[A-Z]{2}$/.test(countryCode) || !/^[A-Z0-9]{3}$/.test(partyId) || pathIdentity.locationId.length > 36) return "La identidad OCPI de la URL no tiene el formato permitido.";
  if (String(value.country_code).toUpperCase() !== countryCode || String(value.party_id).toUpperCase() !== partyId || String(value.id) !== pathIdentity.locationId) return "La identidad OCPI de la URL no coincide con el Location recibido.";
  if (!/^[A-Z]{3}$/.test(String(value.country).toUpperCase()) || typeof value.publish !== "boolean") return "Los campos country o publish de Location OCPI son inválidos.";
  if (new Date(String(value.last_updated)).getTime() !== new Date(String(value.last_updated)).getTime()) return "last_updated no tiene un formato de fecha válido.";
  const coordinates = value.coordinates as Record<string, unknown> | undefined;
  const latitude = Number(coordinates?.latitude);
  const longitude = Number(coordinates?.longitude);
  if (!coordinates || !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return "Las coordenadas de Location OCPI son inválidas.";
  return null;
}

async function recordInboundLocationAudit(db: any, operation: "LOCATION_RECEIVED" | "LOCATION_REJECTED", status: "SUCCESS" | "FAILED", message: string, identity: { countryCode: string; partyId: string; locationId: string }, reason?: string) {
  try {
    await db.insert(ocpiSyncRuns).values({ operation, status, message, details: { provider: "CARGAME", ...identity, reason: reason || null }, completedAt: new Date().toISOString() } as any);
  } catch (error) {
    console.error("[OCPI] No fue posible registrar auditoría de Location entrante", error);
  }
}

export function isValidOcpiInboundToken(authorization: string | undefined, encryptedToken: string | null | undefined) {
  if (!authorization || !encryptedToken) return false;
  const token = authorization.replace(/^Token\s+/i, "").trim();
  const expected = decryptOcpiSecret(encryptedToken);
  if (!token || token.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

const ocpiInboundRouter = Router();

ocpiInboundRouter.put("/locations/:countryCode/:partyId/:locationId", async (req, res) => {
  const settings: any = await getPlatformSettings();
  if (!settings?.ocpiInboundTokenEncrypted) return res.status(503).json({ status_code: 2000, status_message: "OCPI inbound no está configurado." });
  if (!isValidOcpiInboundToken(req.headers.authorization, settings.ocpiInboundTokenEncrypted)) return res.status(401).json({ status_code: 2001, status_message: "Token OCPI inválido." });

  const { countryCode, partyId, locationId } = req.params;
  const location = req.body;
  const db = await getDb();
  if (!db) return res.status(503).json({ status_code: 3000, status_message: "Base de datos no disponible." });
  const identity = { countryCode: countryCode.toUpperCase(), partyId: partyId.toUpperCase(), locationId };
  const validationError = validateOcpiLocation(location, identity);
  if (validationError) {
    await recordInboundLocationAudit(db, "LOCATION_REJECTED", "FAILED", "Location OCPI rechazada.", identity, validationError);
    return res.status(400).json({ status_code: 2000, status_message: validationError });
  }
  const values = {
    provider: "CARGAME", countryCode: identity.countryCode, partyId: identity.partyId, locationId,
    name: location.name || null, address: location.address || null, city: location.city || null,
    latitude: location.coordinates?.latitude || null, longitude: location.coordinates?.longitude || null,
    status: location.publish ? "ACTIVE" : "INACTIVE", lastUpdated: new Date(location.last_updated), rawLocation: sanitizeOcpiPayload(location),
  };
  const existing = await db.select({ id: ocpiRemoteLocations.id }).from(ocpiRemoteLocations).where(and(eq(ocpiRemoteLocations.provider, "CARGAME"), eq(ocpiRemoteLocations.countryCode, values.countryCode), eq(ocpiRemoteLocations.partyId, values.partyId), eq(ocpiRemoteLocations.locationId, locationId))).limit(1);
  if (existing[0]) await db.update(ocpiRemoteLocations).set(values as any).where(eq(ocpiRemoteLocations.id, existing[0].id));
  else await db.insert(ocpiRemoteLocations).values(values as any);
  await recordInboundLocationAudit(db, "LOCATION_RECEIVED", "SUCCESS", "Location OCPI recibida.", identity);
  return res.status(200).json({ status_code: 1000, status_message: "Location OCPI recibida.", timestamp: new Date().toISOString() });
});

export default ocpiInboundRouter;
