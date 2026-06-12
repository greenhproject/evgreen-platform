/**
 * PrivacySettings — Página de configuración de privacidad y datos
 *
 * Cumplimiento Ley 1581/2012:
 * - Art. 8: Derecho de acceso (ver perfil de consumo)
 * - Art. 8: Derecho de supresión (revocar consentimiento)
 * - Transparencia total sobre qué datos se procesan
 */

import { useAuth } from "@/_core/hooks/useAuth";
import UserLayout from "@/layouts/UserLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Shield,
  Brain,
  Megaphone,
  MapPin,
  Eye,
  Trash2,
  Info,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { motion } from "framer-motion";

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export default function PrivacySettings() {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  // Queries
  const { data: consentStatus, isLoading: loadingConsent } =
    trpc.profiles.getConsentStatus.useQuery();
  const { data: profileData, isLoading: loadingProfile } =
    trpc.profiles.getMyProfile.useQuery();

  // Mutations
  const grantMutation = trpc.profiles.grantConsent.useMutation({
    onSuccess: () => {
      utils.profiles.getConsentStatus.invalidate();
      utils.profiles.getMyProfile.invalidate();
      toast.success("Consentimiento actualizado");
    },
    onError: () => toast.error("Error al actualizar consentimiento"),
  });

  const revokeMutation = trpc.profiles.revokeConsent.useMutation({
    onSuccess: () => {
      utils.profiles.getConsentStatus.invalidate();
      utils.profiles.getMyProfile.invalidate();
      toast.success("Consentimiento revocado. Tu perfil ha sido eliminado.");
    },
    onError: () => toast.error("Error al revocar consentimiento"),
  });

  const handleToggleConsent = async (
    type: "AI_PROFILING" | "MARKETING" | "LOCATION_HISTORY",
    currentState: boolean
  ) => {
    if (currentState) {
      // Revocar
      await revokeMutation.mutateAsync({ consentType: type });
    } else {
      // Otorgar
      await grantMutation.mutateAsync({
        consentType: type,
        policyVersion: consentStatus?.currentPolicyVersion || "2026-06-v1",
      });
    }
  };

  const profile = profileData?.profile;

  if (loadingConsent) {
    return (
      <UserLayout title="Privacidad y datos" showBack>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </UserLayout>
    );
  }

  return (
    <UserLayout title="Privacidad y datos" showBack>
      <div className="p-4 space-y-6 pb-24">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-2">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">Privacidad y datos</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Controla cómo EVGreen usa tus datos. Puedes activar o revocar
            permisos en cualquier momento (Ley 1581/2012).
          </p>
        </motion.div>

        {/* Consent Toggles */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="p-4 space-y-4">
            <h2 className="font-semibold text-base">Consentimientos activos</h2>

            {/* AI Profiling */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <Brain className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Perfilamiento IA</p>
                  <p className="text-xs text-muted-foreground">
                    Permite que la IA analice tus hábitos de carga para darte
                    consejos personalizados.
                  </p>
                </div>
              </div>
              {consentStatus?.aiProfiling ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Switch checked={true} />
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Revocar perfilamiento IA?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Al revocar este consentimiento, tu perfil de consumo será
                        <strong> eliminado permanentemente</strong> (derecho de
                        supresión, Ley 1581 Art. 8). El asistente IA seguirá
                        funcionando pero sin personalización.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleToggleConsent("AI_PROFILING", true)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Revocar y eliminar datos
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <Switch
                  checked={false}
                  onCheckedChange={() => handleToggleConsent("AI_PROFILING", false)}
                  disabled={grantMutation.isPending}
                />
              )}
            </div>

            <Separator />

            {/* Marketing */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <Megaphone className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Ofertas personalizadas</p>
                  <p className="text-xs text-muted-foreground">
                    Recibe ofertas y descuentos basados en tu perfil de consumo.
                  </p>
                </div>
              </div>
              <Switch
                checked={consentStatus?.marketing ?? false}
                onCheckedChange={() =>
                  handleToggleConsent("MARKETING", consentStatus?.marketing ?? false)
                }
                disabled={grantMutation.isPending || revokeMutation.isPending}
              />
            </div>

            <Separator />

            {/* Location History */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Historial de ubicaciones</p>
                  <p className="text-xs text-muted-foreground">
                    Permite guardar tus ubicaciones frecuentes para mejorar
                    recomendaciones de estaciones.
                  </p>
                </div>
              </div>
              <Switch
                checked={consentStatus?.locationHistory ?? false}
                onCheckedChange={() =>
                  handleToggleConsent("LOCATION_HISTORY", consentStatus?.locationHistory ?? false)
                }
                disabled={grantMutation.isPending || revokeMutation.isPending}
              />
            </div>
          </Card>
        </motion.div>

        {/* Profile Data (derecho de acceso) */}
        {consentStatus?.aiProfiling && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-primary" />
                  <h2 className="font-semibold text-base">Tu perfil de consumo</h2>
                </div>
                {profile?.confidence && (
                  <Badge
                    variant="outline"
                    className={
                      profile.confidence === "HIGH"
                        ? "border-emerald-500 text-emerald-500"
                        : profile.confidence === "MEDIUM"
                        ? "border-yellow-500 text-yellow-500"
                        : "border-gray-400 text-gray-400"
                    }
                  >
                    Confianza: {profile.confidence}
                  </Badge>
                )}
              </div>

              {loadingProfile ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : profile ? (
                <div className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Sesiones analizadas</p>
                      <p className="font-semibold text-lg">{profile.sessionsAnalyzed}</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Ventana de análisis</p>
                      <p className="font-semibold text-lg">{profile.windowDays} días</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Hora pico</p>
                      <p className="font-semibold text-lg">
                        {profile.peakHour !== null ? `${profile.peakHour}:00` : "—"}
                      </p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Día pico</p>
                      <p className="font-semibold text-lg">
                        {profile.peakWeekday !== null ? DAY_NAMES[profile.peakWeekday] : "—"}
                      </p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Cargas/semana</p>
                      <p className="font-semibold text-lg">{profile.sessionsPerWeek ?? "—"}</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Promedio kWh</p>
                      <p className="font-semibold text-lg">{profile.avgKwhPerSession ?? "—"}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 p-3 bg-blue-500/10 rounded-lg">
                    <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      Estos son los datos que la IA usa para personalizar tus
                      consejos. Nunca se comparten con terceros ni se usan para
                      otros fines.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <Brain className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">
                    Aún no hay suficientes datos para construir tu perfil.
                    Realiza al menos 5 cargas para activarlo.
                  </p>
                </div>
              )}
            </Card>
          </motion.div>
        )}

        {/* Legal info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="text-xs text-muted-foreground space-y-1">
                <p>
                  <strong>Responsable:</strong> EVGreen S.A.S. | NIT: 901.XXX.XXX-X
                </p>
                <p>
                  <strong>Canal de contacto:</strong> datos@evgreen.lat
                </p>
                <p>
                  <strong>Versión de política:</strong>{" "}
                  {consentStatus?.currentPolicyVersion ?? "—"}
                </p>
                <p>
                  Tus derechos incluyen: acceso, rectificación, supresión y
                  revocación del consentimiento (Ley 1581/2012, Art. 8).
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </UserLayout>
  );
}
