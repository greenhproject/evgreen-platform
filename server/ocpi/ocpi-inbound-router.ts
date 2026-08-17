import crypto from "crypto";
import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { ocpiRemoteLocations } from "../../drizzle/schema";
import { getDb, getPlatformSettings } from "../db";
import { decryptOcpiSecret } from "./ocpi-secrets";

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
  if (!location || typeof location !== "object" || String(location.id || "") !== locationId) return res.status(400).json({ status_code: 2000, status_message: "Payload Location OCPI inválido." });
  const db = await getDb();
  if (!db) return res.status(503).json({ status_code: 3000, status_message: "Base de datos no disponible." });
  const values = {
    provider: "CARGAME", countryCode: countryCode.toUpperCase(), partyId: partyId.toUpperCase(), locationId,
    name: location.name || null, address: location.address || null, city: location.city || null,
    latitude: location.coordinates?.latitude || null, longitude: location.coordinates?.longitude || null,
    status: location.publish ? "ACTIVE" : "INACTIVE", lastUpdated: location.last_updated ? new Date(location.last_updated) : new Date(), rawLocation: location,
  };
  const existing = await db.select({ id: ocpiRemoteLocations.id }).from(ocpiRemoteLocations).where(and(eq(ocpiRemoteLocations.provider, "CARGAME"), eq(ocpiRemoteLocations.countryCode, values.countryCode), eq(ocpiRemoteLocations.partyId, values.partyId), eq(ocpiRemoteLocations.locationId, locationId))).limit(1);
  if (existing[0]) await db.update(ocpiRemoteLocations).set(values as any).where(eq(ocpiRemoteLocations.id, existing[0].id));
  else await db.insert(ocpiRemoteLocations).values(values as any);
  return res.status(200).json({ status_code: 1000, status_message: "Location OCPI recibida.", timestamp: new Date().toISOString() });
});

export default ocpiInboundRouter;
