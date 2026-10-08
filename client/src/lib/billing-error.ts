export type BillingErrorDetail = {
  title: string;
  summary: string;
  guidance: string;
  codes: string[];
  raw: string;
  steps?: string[];
  portalUrl?: string;
  transactionId?: number;
};

export function cleanBillingError(raw: unknown): string {
  let text = String(raw ?? "Error desconocido");
  const jsonStart = text.indexOf("{");
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(text.slice(jsonStart));
      text = parsed?.error?.message || parsed?.message || parsed?.error || text;
    } catch {
      // Alegra ocasionalmente devuelve JSON escapado dentro de otro mensaje.
      text = text.slice(jsonStart);
    }
  }
  return text
    .replace(/\\u003c/gi, "<")
    .replace(/\\u003e/gi, ">")
    .replace(/<\/?li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, '"')
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

export function parseBillingError(raw: unknown, transactionId?: number): BillingErrorDetail {
  const cleaned = cleanBillingError(raw);
  const codes = Array.from(new Set(cleaned.match(/\b(?:FAZ|FAB|RUT)\d+[A-Za-z]?\b|\b20\d{3}\b/gi) || []));
  const codeSet = new Set(codes.map((code) => code.toUpperCase()));
  const guidance: string[] = [];
  let steps: string[] | undefined;
  let portalUrl: string | undefined;
  let summary = codes.length
    ? `Códigos detectados: ${codes.join(" · ")}`
    : "El proveedor devolvió un rechazo de validación.";

  if (codeSet.has("FAB05C")) {
    const prefix = cleaned.match(/"prefix"\s*:\s*"([^"\\]+)"/i)?.[1] || "FV";
    portalUrl = "https://catalogo-vpfe.dian.gov.co/User/Login";
    guidance.push("La DIAN aún no reconoce el rango de numeración como asociado al software de Alegra. EVGreen no puede realizar esta asociación por API.");
    summary = `Rango ${prefix} sin asociación en DIAN. Abre “Ver detalle” y completa los pasos antes de reintentar.`;
    steps = [
      "Ingresa al portal Facturando Electrónicamente de la DIAN con las credenciales del facturador.",
      "Ve a Temas de interés > Factura Electrónica > Facturando Electrónicamente.",
      "En el menú izquierdo, abre Configuración > Asociar Rangos de numeración.",
      `En Proveedor - Software selecciona “Soluciones Alegra S.A.S.” y el prefijo “${prefix}”, verificando que corresponda a la numeración vigente en Alegra.`,
      "Haz clic en Agregar y después en Aceptar para guardar la asociación.",
      "Espera al menos 1 hora para que la DIAN sincronice el rango con Alegra; luego verifica la numeración en Alegra y reintenta una sola factura.",
    ];
  }
  if (codeSet.has("FAZ09")) {
    guidance.push("En Alegra, edita el producto configurado y agrega su código UNSPSC/productKey. Luego vuelve a sincronizarlo en EVGreen.");
  }
  if (codeSet.has("RUT01")) {
    guidance.push("RUT01 es una notificación informativa de Alegra sobre la validación futura del RUT; no es la causa principal del rechazo.");
  }
  if (codeSet.has("2035")) {
    guidance.push("El contacto facturado no tiene tipo de identificación; completa CC/NIT u otro tipo válido.");
  }
  if (cleaned.toLowerCase().includes("forma de pago")) {
    guidance.push("Verifica que la forma de pago esté guardada en la configuración de Alegra y vuelve a guardar la configuración.");
  }

  return {
    title: codes.length ? `Alegra rechazó la factura (${codes.join(" · ")})` : "Alegra rechazó la factura",
    summary,
    guidance: guidance.join(" ") || "Revisa el detalle técnico y la configuración del proveedor antes de reintentar.",
    codes,
    raw: cleaned,
    steps,
    portalUrl,
    transactionId,
  };
}
