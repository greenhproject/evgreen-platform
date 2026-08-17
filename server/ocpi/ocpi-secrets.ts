import crypto from "crypto";
import { ENV } from "../_core/env";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  if (!ENV.cookieSecret || ENV.cookieSecret.length < 16) {
    throw new Error("No hay una clave de plataforma válida para cifrar la configuración OCPI");
  }
  return crypto.createHash("sha256").update(ENV.cookieSecret).digest();
}

export function encryptOcpiSecret(value: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function decryptOcpiSecret(value: string): string {
  const raw = Buffer.from(value, "base64url");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function maskOcpiSecret(value: string | null | undefined): string {
  if (!value) return "";
  return `••••${value.slice(-4)}`;
}

export function isSafeOcpiVersionsUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" || !url.hostname) return false;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false;
    if (/^(127\.|10\.|192\.168\.|0\.)/.test(host)) return false;
    return !/^172\.(1[6-9]|2\d|3[01])\./.test(host);
  } catch {
    return false;
  }
}
