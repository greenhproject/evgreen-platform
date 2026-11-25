import { useState } from "react";
import { Download, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { prepareStoredPdfDownload } from "@/lib/stored-pdf-download";

export function SignedLetterDownload({ spaceId, acceptedAt, hasStoredPdf }: {
  spaceId: number;
  acceptedAt: Date | string | null | undefined;
  hasStoredPdf: boolean;
}) {
  const download = trpc.spaces.admin.downloadSignedLetterPdf.useMutation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!acceptedAt && !hasStoredPdf) return null;
  const unavailable = !acceptedAt || !hasStoredPdf;
  const handleDownload = async () => {
    if (busy || unavailable) return;
    setBusy(true);
    setError(null);
    let prepared: ReturnType<typeof prepareStoredPdfDownload> | undefined;
    try {
      prepared = prepareStoredPdfDownload();
      const result = await download.mutateAsync({ id: spaceId });
      prepared.save(result.base64, result.fileName);
      toast.success(prepared.opensViewer
        ? "Carta firmada abierta. Usa Compartir o Guardar para conservar el PDF."
        : "Descarga de la carta firmada preparada.");
    } catch (cause) {
      prepared?.cancel();
      const message = cause instanceof Error ? cause.message : "No fue posible descargar la carta firmada. Vuelve a intentarlo.";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section aria-label="Carta de intención firmada" className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-emerald-200">Carta de intención firmada</p>
          <p className="mt-1 text-xs text-gray-400">PDF original conservado, con sus datos de firma. No se vuelve a emitir.</p>
        </div>
        <Button type="button" size="sm" onClick={handleDownload} disabled={busy || unavailable} aria-busy={busy} className="h-auto min-h-10 w-full shrink-0 whitespace-normal bg-emerald-600 px-3 py-2 text-xs text-white hover:bg-emerald-700 sm:w-auto">
          {busy ? <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" /> : <Download className="mr-2 h-4 w-4 shrink-0" />}
          {busy ? "Descargando carta…" : "Descargar carta firmada"}
        </Button>
      </div>
      {unavailable && <p role="status" className="mt-2 flex items-start gap-2 text-xs text-amber-200"><AlertTriangle className="h-4 w-4 shrink-0" />Esta carta no conserva un PDF firmado disponible para descargar. La firma no se modificará ni se generará otro documento automáticamente.</p>}
      {error && <p role="alert" className="mt-2 text-xs text-red-300">{error} Puedes reintentar con el botón de descarga.</p>}
    </section>
  );
}
