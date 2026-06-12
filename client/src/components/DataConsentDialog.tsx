/**
 * DataConsentDialog — Diálogo de consentimiento para tratamiento de datos
 *
 * Cumplimiento Ley 1581 de 2012 (Colombia):
 * - Consentimiento previo, expreso e informado (checkbox NO premarcado)
 * - Texto claro sobre finalidad, derechos y canal de contacto
 * - Opt-in separado para perfilamiento IA y para marketing
 * - Versionado de la política aceptada (auditoría)
 *
 * Uso: mostrarlo en el primer login del usuario final, o al intentar
 * usar el asistente IA sin consentimiento previo.
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const POLICY_VERSION = "2026-06-v1"; // Debe coincidir con CURRENT_POLICY_VERSION del backend

interface DataConsentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Se llama cuando el usuario completó el flujo (aceptó o continuó sin IA) */
  onCompleted?: (aiConsented: boolean) => void;
}

export function DataConsentDialog({
  open,
  onOpenChange,
  onCompleted,
}: DataConsentDialogProps) {
  // ⚠️ Ley 1581: los checkboxes inician SIEMPRE desmarcados
  const [aiChecked, setAiChecked] = useState(false);
  const [marketingChecked, setMarketingChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const grantMutation = trpc.profiles.grantConsent.useMutation();
  const utils = trpc.useUtils();

  const handleAccept = async () => {
    setSubmitting(true);
    try {
      if (aiChecked) {
        await grantMutation.mutateAsync({
          consentType: "AI_PROFILING",
          policyVersion: POLICY_VERSION,
        });
      }
      if (marketingChecked) {
        await grantMutation.mutateAsync({
          consentType: "MARKETING",
          policyVersion: POLICY_VERSION,
        });
      }
      await utils.profiles.getConsentStatus.invalidate();

      if (aiChecked) {
        toast.success("¡Listo! Tu asistente IA ahora aprenderá de tus hábitos de carga.");
      }
      onCompleted?.(aiChecked);
      onOpenChange(false);
    } catch {
      toast.error("No pudimos guardar tu preferencia. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    onCompleted?.(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-600" />
            <DialogTitle>Activa tu asistente IA personalizado</DialogTitle>
          </div>
          <DialogDescription>
            EVGreen puede analizar tus hábitos de carga para darte consejos y
            ofertas hechas a tu medida. Tú decides.
          </DialogDescription>
        </DialogHeader>

        {/* ---------------- Disclaimer / Aviso de privacidad ---------------- */}
        <ScrollArea className="h-48 rounded-md border p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-2">
            Autorización para el tratamiento de datos personales
          </p>
          <p className="mb-2">
            En cumplimiento de la Ley 1581 de 2012 y el Decreto 1377 de 2013,
            <strong> EVGreen S.A.S.</strong>, como responsable del tratamiento,
            solicita tu autorización para analizar tus datos de uso de la
            plataforma con las siguientes finalidades:
          </p>
          <p className="mb-2">
            <strong>Qué datos usamos:</strong> historial de sesiones de carga
            (fechas, horarios, duración, energía consumida, costo), estaciones
            utilizadas y modo de carga preferido.
          </p>
          <p className="mb-2">
            <strong>Para qué:</strong> construir tu perfil de hábitos de consumo
            y, mediante inteligencia artificial, ofrecerte recomendaciones de
            ahorro, sugerencias de horarios y estaciones, y — si lo autorizas
            por separado — ofertas comerciales personalizadas.
          </p>
          <p className="mb-2">
            <strong>Tus derechos:</strong> en cualquier momento puedes conocer,
            actualizar, rectificar o suprimir tus datos, y revocar esta
            autorización desde <em>Perfil → Privacidad</em>. Al revocarla,
            tu perfil de consumo se elimina de forma permanente.
          </p>
          <p className="mb-2">
            <strong>Qué NO hacemos:</strong> no vendemos tus datos a terceros
            ni los usamos para finalidades distintas a las aquí descritas.
          </p>
          <p>
            Canal de contacto: <strong>datos@evgreen.lat</strong>. Política
            completa en evgreen.lat/privacidad. Versión: {POLICY_VERSION}.
          </p>
        </ScrollArea>

        {/* ---------------- Checkboxes (opt-in, NO premarcados) ---------------- */}
        <div className="space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <Checkbox
              checked={aiChecked}
              onCheckedChange={v => setAiChecked(v === true)}
              className="mt-0.5"
            />
            <span className="text-sm leading-snug">
              <strong>Acepto</strong> el tratamiento de mis datos de carga para
              que la IA de EVGreen aprenda mis hábitos y me dé consejos
              personalizados.
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <Checkbox
              checked={marketingChecked}
              onCheckedChange={v => setMarketingChecked(v === true)}
              className="mt-0.5"
            />
            <span className="text-sm leading-snug">
              <strong>Acepto</strong> recibir ofertas y promociones
              personalizadas basadas en mi perfil. (Opcional)
            </span>
          </label>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            onClick={handleAccept}
            disabled={!aiChecked || submitting}
            className="w-full bg-emerald-600 hover:bg-emerald-700"
          >
            <ShieldCheck className="h-4 w-4 mr-2" />
            {submitting ? "Guardando..." : "Activar IA personalizada"}
          </Button>
          <Button
            variant="ghost"
            onClick={handleSkip}
            disabled={submitting}
            className="w-full text-muted-foreground"
          >
            Continuar sin personalización
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Hook auxiliar: decide si se debe mostrar el diálogo.
 *
 * const { shouldShow } = useConsentGate();
 * <DataConsentDialog open={shouldShow} ... />
 */
export function useConsentGate() {
  const { data, isLoading } = trpc.profiles.getConsentStatus.useQuery(undefined, {
    // Solo consultar si el usuario está autenticado (evitar errores en login)
    retry: false,
  });
  return {
    isLoading,
    shouldShow: !isLoading && data ? !data.aiProfiling : false,
    aiConsented: data?.aiProfiling ?? false,
  };
}
