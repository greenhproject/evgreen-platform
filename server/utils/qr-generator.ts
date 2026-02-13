/**
 * QR Code Generator for Emails
 * 
 * Genera QR codes como data URI base64 para incrustar directamente en emails HTML.
 * Esto evita usar servicios externos como api.qrserver.com que causan que los emails
 * vayan a la carpeta de spam (Resend Insight: "Host images on the sending domain").
 * 
 * Alternativa: También puede generar el QR como Buffer y subirlo a S3 con storagePut.
 */

import QRCode from "qrcode";
import { storagePut } from "../storage";

/**
 * Genera un QR code como data URI base64 (para incrustar inline en emails)
 * Los clientes de email como Gmail pueden bloquear data URIs,
 * así que preferimos subir a S3 con generateQRCodeUrl()
 */
export async function generateQRCodeDataUri(
  data: string,
  options?: {
    width?: number;
    color?: { dark?: string; light?: string };
    margin?: number;
  }
): Promise<string> {
  const dataUri = await QRCode.toDataURL(data, {
    width: options?.width || 300,
    margin: options?.margin || 2,
    color: {
      dark: options?.color?.dark || "#22c55e",
      light: options?.color?.light || "#0a0a0a",
    },
    errorCorrectionLevel: "M",
  });
  return dataUri;
}

/**
 * Genera un QR code como Buffer PNG
 */
export async function generateQRCodeBuffer(
  data: string,
  options?: {
    width?: number;
    color?: { dark?: string; light?: string };
    margin?: number;
  }
): Promise<Buffer> {
  const buffer = await QRCode.toBuffer(data, {
    type: "png",
    width: options?.width || 300,
    margin: options?.margin || 2,
    color: {
      dark: options?.color?.dark || "#22c55e",
      light: options?.color?.light || "#0a0a0a",
    },
    errorCorrectionLevel: "M",
  });
  return buffer;
}

/**
 * Genera un QR code, lo sube a S3 y retorna la URL pública.
 * Esta es la opción preferida para emails ya que:
 * - La imagen está hospedada en nuestro propio dominio/S3
 * - No depende de servicios externos
 * - Gmail y otros clientes de email la muestran correctamente
 * - Resend no la marca como sospechosa
 */
export async function generateQRCodeUrl(
  data: string,
  fileKey: string,
  options?: {
    width?: number;
    color?: { dark?: string; light?: string };
    margin?: number;
  }
): Promise<string> {
  const buffer = await generateQRCodeBuffer(data, options);
  const { url } = await storagePut(fileKey, buffer, "image/png");
  return url;
}
