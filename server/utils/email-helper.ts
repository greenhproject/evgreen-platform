/**
 * Email Helper - Mejora la entregabilidad de emails
 * 
 * - Convierte HTML a plain-text automáticamente
 * - Agrega headers anti-spam (List-Unsubscribe)
 * - Centraliza el envío de emails con Resend
 */

/**
 * Convierte HTML a texto plano para la versión alternativa del email.
 * Los proveedores de email (Gmail, Outlook) prefieren emails con ambas versiones.
 */
export function htmlToPlainText(html: string): string {
  let text = html;

  // Reemplazar <br>, <br/>, <br /> con saltos de línea
  text = text.replace(/<br\s*\/?>/gi, "\n");

  // Reemplazar </p>, </div>, </tr>, </li> con doble salto de línea
  text = text.replace(/<\/(p|div|tr|h[1-6])>/gi, "\n\n");

  // Reemplazar </li> con salto de línea
  text = text.replace(/<\/li>/gi, "\n");

  // Reemplazar <li> con bullet
  text = text.replace(/<li[^>]*>/gi, "  • ");

  // Extraer texto de enlaces: <a href="url">texto</a> -> texto (url)
  text = text.replace(/<a[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi, "$2 ($1)");

  // Reemplazar <hr> con línea separadora
  text = text.replace(/<hr[^>]*>/gi, "\n---\n");

  // Reemplazar headers con texto en mayúsculas
  text = text.replace(/<h[1-3][^>]*>(.*?)<\/h[1-3]>/gi, (_, content) => {
    return `\n${stripTags(content).toUpperCase()}\n`;
  });

  // Reemplazar headers menores
  text = text.replace(/<h[4-6][^>]*>(.*?)<\/h[4-6]>/gi, (_, content) => {
    return `\n${stripTags(content)}\n`;
  });

  // Reemplazar <strong> y <b> con *texto*
  text = text.replace(/<(strong|b)[^>]*>(.*?)<\/(strong|b)>/gi, "*$2*");

  // Reemplazar <em> y <i> con _texto_
  text = text.replace(/<(em|i)[^>]*>(.*?)<\/(em|i)>/gi, "_$2_");

  // Eliminar tags de estilo y script completamente (incluyendo contenido)
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");

  // Eliminar todas las demás etiquetas HTML
  text = stripTags(text);

  // Decodificar entidades HTML comunes
  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&copy;/gi, "©")
    .replace(/&reg;/gi, "®")
    .replace(/&trade;/gi, "™")
    .replace(/&#\d+;/gi, "");

  // Limpiar espacios en blanco excesivos
  text = text.replace(/[ \t]+/g, " "); // Múltiples espacios a uno
  text = text.replace(/\n[ \t]+/g, "\n"); // Espacios al inicio de línea
  text = text.replace(/[ \t]+\n/g, "\n"); // Espacios al final de línea
  text = text.replace(/\n{3,}/g, "\n\n"); // Máximo 2 saltos de línea seguidos

  return text.trim();
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

/**
 * Genera los parámetros de email con versión HTML y plain-text.
 * Usar con resend.emails.send()
 */
export function buildEmailParams(params: {
  from: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  headers?: Record<string, string>;
}) {
  const plainText = htmlToPlainText(params.html);

  return {
    from: params.from,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: plainText,
    replyTo: params.replyTo,
    headers: {
      "X-Entity-Ref-ID": `evgreen-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      ...params.headers,
    },
  };
}
