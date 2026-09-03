import crypto from "crypto";
import { ENV } from "../_core/env";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  if (!ENV.cookieSecret || ENV.cookieSecret.length < 16) {
    throw new Error("No hay una clave de plataforma válida para proteger la configuración de DocuSign");
  }
  return crypto.createHash("sha256").update(ENV.cookieSecret).digest();
}

export function encryptDocusignSecret(value: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}

export function decryptDocusignSecret(value: string): string {
  const raw = Buffer.from(value, "base64url");
  if (raw.length < 29) throw new Error("El secreto cifrado de DocuSign no tiene un formato válido");
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}

export function maskDocusignSecret(value?: string | null): string {
  if (!value) return "";
  return "•••••••• configurado";
}
