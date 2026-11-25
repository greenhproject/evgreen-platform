import { saveBlobCrossPlatform } from "./pdf-download";

/** Reserve Safari's viewer during the click, before the asynchronous RPC. */
export function prepareStoredPdfDownload() {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const safari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const viewer = ios || safari ? window.open("about:blank", "_blank") : null;
  if ((ios || safari) && !viewer) {
    throw new Error("Permite abrir una pestaña para guardar la carta firmada y vuelve a intentarlo.");
  }
  if (viewer) {
    viewer.opener = null;
    viewer.document.title = "Carta de intención firmada";
    viewer.document.body.textContent = "Preparando el PDF firmado…";
  }
  return {
    opensViewer: Boolean(viewer),
    save(base64: string, fileName: string) {
      const bytes = Uint8Array.from(window.atob(base64), character => character.charCodeAt(0));
      if (String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-") {
        throw new Error("No se recibió un PDF válido. Vuelve a intentar la descarga.");
      }
      // Never render, regenerate or rewrite the signed document.
      const blob = new Blob([bytes], { type: "application/pdf" });
      if (!viewer) {
        saveBlobCrossPlatform(blob, fileName);
        return;
      }
      if (viewer.closed) {
        throw new Error("La pestaña del PDF se cerró. Vuelve a pulsar Descargar carta firmada.");
      }
      const url = URL.createObjectURL(blob);
      try {
        viewer.location.replace(url);
      } catch (error) {
        URL.revokeObjectURL(url);
        throw error;
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    },
    cancel() {
      if (viewer && !viewer.closed) viewer.close();
    },
  };
}
