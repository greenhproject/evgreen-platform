/**
 * EVGreen - Aceptación de Carta de Intención
 * Página pública accedida por email para firmar digitalmente la carta
 */
import { useState } from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Zap, CheckCircle2, FileText, Loader2, ShieldCheck, AlertTriangle, Download, Mail } from "lucide-react";

export default function SpaceLetterAccept() {
  const [, params] = useRoute("/carta-intencion/:token");
  const token = params?.token || "";

  const [signerName, setSignerName] = useState("");
  const [signerDocument, setSignerDocument] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [termsChecked, setTermsChecked] = useState(false);
  const [result, setResult] = useState<{ success: boolean; spaceName?: string; code?: string } | null>(null);

  const acceptMutation = trpc.spaces.acceptLetter.useMutation();

  const handleAccept = async () => {
    if (!signerName.trim()) {
      toast.error("Ingrese su nombre completo");
      return;
    }
    if (!signerDocument.trim() || signerDocument.length < 5) {
      toast.error("Ingrese su número de documento");
      return;
    }
    if (!termsChecked) {
      toast.error("Debe aceptar los términos de la carta de intención");
      return;
    }

    try {
      const res = await acceptMutation.mutateAsync({
        token,
        signerName: signerName.trim(),
        signerDocument: signerDocument.trim(),
      });
      setResult(res);
      toast.success("Carta de intención firmada exitosamente");
    } catch (err: any) {
      toast.error(err.message || "Error al firmar la carta");
    }
  };

  // Success view
  if (result?.success) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center p-4">
        <div className="max-w-lg w-full text-center">
          <div className="relative mb-8">
            <div className="w-24 h-24 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center">
              <ShieldCheck className="w-12 h-12 text-emerald-400" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-white mb-3">
            Carta Firmada Exitosamente
          </h1>
          <p className="text-gray-400 mb-6">
            Ha firmado digitalmente la carta de intención para el espacio <strong className="text-white">{result.spaceName}</strong>.
          </p>

          <div className="bg-[#111827] border border-[#1f2937] rounded-2xl p-6 mb-6">
            <p className="text-sm text-gray-400 mb-2">Código de postulación</p>
            <p className="text-xl font-mono font-bold text-emerald-400">{result.code}</p>
          </div>

          {/* Constancia PDF */}
          <div className="bg-[#111827] border border-emerald-500/30 rounded-2xl p-6 mb-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <FileText className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Constancia de Firma Digital</h3>
                <p className="text-xs text-gray-500">Documento PDF generado automáticamente</p>
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              Se ha generado un PDF con la constancia de su firma digital que incluye sus datos, fecha, hora, IP y hash de verificación. <strong className="text-gray-300">También se ha enviado una copia a su correo electrónico.</strong>
            </p>
            <div className="flex items-center gap-2 text-xs text-emerald-400/70">
              <Mail className="w-3.5 h-3.5" />
              <span>Revise su bandeja de entrada para la copia del documento</span>
            </div>
          </div>

          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 mb-6 text-left">
            <h3 className="text-sm font-medium text-emerald-300 mb-2">Próximos pasos:</h3>
            <ul className="text-sm text-gray-400 space-y-1.5">
              <li>1. Nuestro equipo publicará su espacio en la plataforma de inversión</li>
              <li>2. Inversionistas podrán ver y financiar la instalación del cargador</li>
              <li>3. Una vez fondeado, coordinaremos la instalación</li>
              <li>4. Comenzará a generar ingresos pasivos por cada carga realizada</li>
            </ul>
          </div>

          <Button
            onClick={() => window.location.href = "/"}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            Ir al inicio
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1a]">
      {/* Header */}
      <header className="border-b border-[#1f2937] bg-[#0a0f1a]/80 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold text-white">EVGreen</span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/20 flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Carta de Intención</h1>
          <p className="text-gray-400">Firma digital para formalizar su participación como aliado comercial EVGreen</p>
        </div>

        {/* Letter content */}
        <div className="bg-[#111827] border border-[#1f2937] rounded-2xl p-6 sm:p-8 mb-6">
          <div className="prose prose-invert max-w-none">
            <p className="text-gray-300 text-sm leading-relaxed mb-4">
              Por medio de la presente, manifiesto mi interés y voluntad de participar como <strong className="text-white">Aliado Comercial</strong> en la red de infraestructura de carga para vehículos eléctricos de <strong className="text-emerald-400">EVGreen</strong>, una marca de Green House Project S.A.S. (NIT 901.856.696-1).
            </p>

            <p className="text-gray-300 text-sm leading-relaxed mb-4">
              Declaro que soy el propietario, representante legal o persona autorizada para disponer del espacio postulado, y que:
            </p>

            <ul className="text-gray-300 text-sm space-y-2 mb-4 list-disc list-inside">
              <li>Autorizo a EVGreen a realizar los estudios técnicos necesarios para evaluar la viabilidad de instalación de cargadores de vehículos eléctricos en mi espacio.</li>
              <li>Autorizo la publicación de la información del espacio en la plataforma de inversión de EVGreen para atraer capital que financie la instalación.</li>
              <li>Me comprometo a facilitar el acceso al espacio para las visitas técnicas y la eventual instalación de los equipos.</li>
              <li>Entiendo que esta carta de intención no constituye un contrato vinculante, sino una manifestación de interés mutuo que será formalizada mediante un contrato específico una vez se asegure el financiamiento.</li>
            </ul>

            <p className="text-gray-300 text-sm leading-relaxed mb-4">
              EVGreen se compromete a:
            </p>

            <ul className="text-gray-300 text-sm space-y-2 mb-4 list-disc list-inside">
              <li>Realizar la inversión necesaria para la instalación de los cargadores sin costo para el aliado comercial.</li>
              <li>Encargarse de la operación, mantenimiento y soporte técnico de los equipos.</li>
              <li>Compartir un porcentaje de los ingresos generados por las cargas realizadas en el espacio, según los términos que se acuerden en el contrato definitivo.</li>
            </ul>

            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mt-6">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-300">
                  <strong>Nota legal:</strong> Esta carta de intención es un documento preliminar que expresa la voluntad de las partes. Los términos definitivos serán establecidos en un contrato formal que será negociado y firmado por ambas partes antes de cualquier instalación.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Signature form */}
        <div className="bg-[#111827] border border-[#1f2937] rounded-2xl p-6 sm:p-8">
          <h3 className="text-lg font-semibold text-white mb-4">Firma Digital</h3>

          <div className="space-y-4">
            <div>
              <Label className="text-gray-300 mb-1.5 block">Nombre completo del firmante *</Label>
              <Input
                value={signerName}
                onChange={e => setSignerName(e.target.value)}
                placeholder="Nombre completo como aparece en su documento"
                className="bg-[#0a0f1a] border-[#374151] text-white placeholder:text-gray-600"
              />
            </div>

            <div>
              <Label className="text-gray-300 mb-1.5 block">Número de documento (CC/NIT) *</Label>
              <Input
                value={signerDocument}
                onChange={e => setSignerDocument(e.target.value)}
                placeholder="1.234.567.890"
                className="bg-[#0a0f1a] border-[#374151] text-white placeholder:text-gray-600"
              />
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={termsChecked}
                onChange={e => setTermsChecked(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-[#374151] bg-[#0a0f1a] text-emerald-500 focus:ring-emerald-500"
              />
              <span className="text-sm text-gray-400">
                He leído y acepto los términos de la carta de intención. Confirmo que tengo la autoridad para firmar este documento en representación del espacio postulado.
              </span>
            </label>

            <Button
              onClick={handleAccept}
              disabled={acceptMutation.isPending || !termsChecked}
              className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white py-3"
            >
              {acceptMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Firmando...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  Firmar Carta de Intención
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
