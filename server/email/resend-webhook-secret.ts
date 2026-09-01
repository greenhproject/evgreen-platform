import crypto from "crypto";
import { ENV } from "../_core/env";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  if (!ENV.cookieSecret || ENV.cookieSecret.length < 16) {
    throw new Error("No hay una clave de plataforma válida para cifrar la configuración de correo");
  }
  return crypto.createHash("sha256").update(ENV.cookieSecret).digest();
}

export function encryptResendWebhookSecret(value: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}

export function decryptResendWebhookSecret(value: string): string {
  const raw = Buffer.from(value, "base64url");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
