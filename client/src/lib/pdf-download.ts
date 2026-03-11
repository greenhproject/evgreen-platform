/**
 * Utilidad para descarga de PDFs compatible con iOS/Safari y Android/Chrome
 * 
 * Problema: `doc.save()` de jsPDF usa internamente `<a download>` que no funciona
 * correctamente en iOS Safari, causando PDFs en blanco o que no se descargan.
 * 
 * Solución: Detectar iOS/Safari y usar `window.open(bloburl)` como alternativa.
 */

import type { jsPDF } from "jspdf";

/**
 * Detecta si el navegador es iOS (iPhone, iPad, iPod)
 */
function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/**
 * Detecta si el navegador es Safari (no Chrome en iOS)
 */
function isSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

/**
 * Descarga un PDF generado con jsPDF de forma compatible con iOS/Safari
 * 
 * En iOS/Safari: abre el PDF en una nueva pestaña donde el usuario puede guardarlo
 * En otros navegadores: usa el método estándar doc.save() para descarga directa
 * 
 * @param doc - Instancia de jsPDF con el PDF generado
 * @param filename - Nombre del archivo para la descarga
 */
export function savePdfCrossPlatform(doc: jsPDF, filename: string): void {
  if (isIOS() || isSafari()) {
    // En iOS/Safari, abrir en nueva pestaña para que el usuario pueda guardar
    const blobUrl = doc.output("bloburl");
    window.open(blobUrl as unknown as string, "_blank");
  } else {
    // En Android/Chrome/Firefox, descarga directa
    doc.save(filename);
  }
}

/**
 * Descarga un archivo desde un Blob de forma compatible con iOS/Safari
 * 
 * Usado para PDFs generados en el servidor y enviados como base64/blob
 * 
 * @param blob - Blob del archivo a descargar
 * @param filename - Nombre del archivo para la descarga
 */
export function saveBlobCrossPlatform(blob: Blob, filename: string): void {
  if (isIOS() || isSafari()) {
    // En iOS/Safari, abrir en nueva pestaña
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    // Revocar después de un delay para dar tiempo a que se abra
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } else {
    // En Android/Chrome/Firefox, descarga directa con <a download>
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
