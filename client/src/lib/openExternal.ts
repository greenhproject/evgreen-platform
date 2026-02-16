/**
 * Abre una URL externa fuera de la PWA.
 * En modo standalone (PWA instalada), usa múltiples estrategias para asegurar
 * que el enlace se abra en el navegador del sistema, no dentro de la app.
 */
export function openExternalUrl(url: string): void {
  if (!url) return;

  // Verificar si es una URL externa (diferente dominio)
  const isExternal = isExternalUrl(url);

  if (isExternal) {
    // Estrategia 1: Crear un <a> temporal con target="_blank" y rel="noopener"
    // Esto funciona mejor en PWAs standalone que window.open()
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    
    // En algunos navegadores Android (Samsung Internet), necesitamos
    // agregar el link al DOM brevemente para que el click funcione
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    
    // Limpiar después de un breve delay
    setTimeout(() => {
      document.body.removeChild(link);
    }, 100);
  } else {
    // Para URLs internas, usar navegación normal
    window.location.href = url;
  }
}

/**
 * Verifica si una URL es externa (diferente dominio al actual).
 */
export function isExternalUrl(url: string): boolean {
  if (!url) return false;
  
  try {
    // URLs relativas son internas
    if (url.startsWith("/") || url.startsWith("#") || url.startsWith("?")) {
      return false;
    }
    
    // URLs con protocolo diferente (mailto:, tel:, etc.) son externas
    if (url.startsWith("mailto:") || url.startsWith("tel:") || url.startsWith("sms:")) {
      return true;
    }
    
    const currentHost = window.location.hostname;
    const urlObj = new URL(url, window.location.origin);
    
    return urlObj.hostname !== currentHost;
  } catch {
    // Si no se puede parsear, asumir que es externa
    return true;
  }
}

/**
 * Verifica si la app está corriendo en modo PWA standalone.
 */
export function isPWAStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes("android-app://")
  );
}
