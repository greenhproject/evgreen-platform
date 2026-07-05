import UserLayout from "@/layouts/UserLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Bell, BellRing, Mail, MessageSquare, Zap, DollarSign, AlertTriangle, Send, Loader2, MapPin, Navigation, Wallet, ShieldAlert, FileText, TrendingUp, Tag } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useNotifications } from "@/hooks/useNotifications";

export default function UserNotifications() {
  const [, setLocation] = useLocation();
  const {
    isSupported,
    isEnabled: pushEnabled,
    isLoading,
    permissionStatus,
    preferences,
    error,
    enableNotifications,
    disableNotifications,
    updatePreferences,
    sendTestNotification,
  } = useNotifications();

  // Preferencias de proximidad
  const proximityPrefs = trpc.push.getProximityPreferences.useQuery();
  const updateProximityMut = trpc.push.updateProximityPreferences.useMutation({
    onSuccess: () => {
      proximityPrefs.refetch();
      toast.success("Preferencias de proximidad actualizadas");
    },
  });

  // Preferencias de WhatsApp
  const waPrefs = trpc.userConfig.getWhatsAppPreferences.useQuery();
  const updateWaMut = trpc.userConfig.updateWhatsAppPreferences.useMutation({
    onError: () => {
      toast.error("Error al guardar preferencias de WhatsApp");
    },
    onSuccess: () => {
      waPrefs.refetch();
      toast.success("Preferencias de WhatsApp actualizadas");
    },
  });

  // Preferencias de email
  const emailPrefs = trpc.userConfig.getEmailPreferences.useQuery();
  const updateEmailMut = trpc.userConfig.updateEmailPreferences.useMutation({
    onError: () => {
      toast.error("Error al guardar preferencias de email");
    },
    onSuccess: () => {
      emailPrefs.refetch();
      toast.success("Preferencias de email actualizadas");
    },
  });

  const handleWaToggle = (key: "waNotifyChargeStart" | "waNotifyChargeEnd" | "waNotifyReminder" | "waNotifyPenalty" | "waNotifyWallet") => {
    if (!waPrefs.data) return;
    updateWaMut.mutate({ [key]: !waPrefs.data[key] });
  };

  const handleEmailToggle = (key: "emailNotifyEnabled" | "emailNotifyReceipts" | "emailNotifyWeeklyReport" | "emailNotifyPromotions") => {
    if (!emailPrefs.data) return;
    updateEmailMut.mutate({ [key]: !emailPrefs.data[key] });
  };

  const handleProximityToggle = async () => {
    const newValue = !(proximityPrefs.data?.enabled ?? true);
    updateProximityMut.mutate({ enabled: newValue });
  };

  const handleRadiusChange = (value: number[]) => {
    updateProximityMut.mutate({ radiusKm: value[0] });
  };

  const handlePushToggle = async () => {
    if (pushEnabled) {
      await disableNotifications();
    } else {
      await enableNotifications();
    }
  };

  const handlePreferenceToggle = async (key: "chargingComplete" | "lowBalance" | "promotions") => {
    if (!preferences) return;
    await updatePreferences({ [key]: !preferences[key] });
  };

  const emailEnabled = emailPrefs.data?.emailNotifyEnabled ?? true;

  return (
    <UserLayout showHeader={false} showBottomNav={false}>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/50">
          <div className="flex items-center gap-4 p-4">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => setLocation("/profile")}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-semibold">Notificaciones</h1>
          </div>
        </div>

        <div className="p-4 space-y-4 pb-8">
          {/* Push Notifications */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bell className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base">Notificaciones Push</CardTitle>
                  <CardDescription>
                    {!isSupported
                      ? "No soportado en este navegador"
                      : permissionStatus === "denied" 
                      ? "Permiso denegado en el navegador"
                      : pushEnabled
                      ? "Notificaciones activas"
                      : "Recibe alertas en tu dispositivo"}
                  </CardDescription>
                </div>
                <Switch
                  checked={pushEnabled}
                  onCheckedChange={handlePushToggle}
                  disabled={isLoading || permissionStatus === "denied" || !isSupported}
                />
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              </div>
            </CardHeader>
            {pushEnabled && preferences && (
              <CardContent className="space-y-4 pt-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Zap className="w-4 h-4 text-muted-foreground" />
                    <Label htmlFor="chargingComplete" className="text-sm">Carga completada</Label>
                  </div>
                  <Switch
                    id="chargingComplete"
                    checked={preferences.chargingComplete}
                    onCheckedChange={() => handlePreferenceToggle("chargingComplete")}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                    <Label htmlFor="lowBalance" className="text-sm">Saldo bajo</Label>
                  </div>
                  <Switch
                    id="lowBalance"
                    checked={preferences.lowBalance}
                    onCheckedChange={() => handlePreferenceToggle("lowBalance")}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="w-4 h-4 text-muted-foreground" />
                    <Label htmlFor="promotions" className="text-sm">Promociones y ofertas</Label>
                  </div>
                  <Switch
                    id="promotions"
                    checked={preferences.promotions}
                    onCheckedChange={() => handlePreferenceToggle("promotions")}
                  />
                </div>
                
                {/* Botón de prueba */}
                <div className="pt-2 border-t border-border/50">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={sendTestNotification}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Enviar notificación de prueba
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Proximity Alerts */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center">
                  <Navigation className="w-5 h-5 text-cyan-500" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base">Alertas de Proximidad</CardTitle>
                  <CardDescription>
                    {proximityPrefs.data?.enabled
                      ? `Alertas activas (radio: ${proximityPrefs.data?.radiusKm || 5} km)`
                      : "Recibe alertas cuando estés cerca de estaciones compatibles con precio bajo"}
                  </CardDescription>
                </div>
                <Switch
                  checked={proximityPrefs.data?.enabled ?? true}
                  onCheckedChange={handleProximityToggle}
                  disabled={!pushEnabled || updateProximityMut.isPending}
                />
              </div>
            </CardHeader>
            {proximityPrefs.data?.enabled && pushEnabled && (
              <CardContent className="space-y-4 pt-0">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <Label className="text-sm">Radio de búsqueda</Label>
                    </div>
                    <span className="text-sm font-medium text-primary">
                      {proximityPrefs.data?.radiusKm || 5} km
                    </span>
                  </div>
                  <Slider
                    defaultValue={[proximityPrefs.data?.radiusKm || 5]}
                    min={1}
                    max={10}
                    step={1}
                    onValueCommit={handleRadiusChange}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>1 km</span>
                    <span>5 km</span>
                    <span>10 km</span>
                  </div>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
                  <p className="flex items-center gap-1.5">
                    <Zap className="w-3 h-3" />
                    Filtra estaciones compatibles con tu vehículo
                  </p>
                  <p className="flex items-center gap-1.5">
                    <DollarSign className="w-3 h-3" />
                    Solo notifica cuando el precio es bajo o normal
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Bell className="w-3 h-3" />
                    Máximo 1 alerta cada 30 minutos
                  </p>
                </div>
              </CardContent>
            )}
            {!pushEnabled && (
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground">
                  Activa las notificaciones push para usar alertas de proximidad
                </p>
              </CardContent>
            )}
          </Card>

          {/* WhatsApp Notifications */}
          <Card className="border-green-500/20">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base">Notificaciones por WhatsApp</CardTitle>
                  <CardDescription>
                    Controla qué mensajes recibes en tu WhatsApp
                  </CardDescription>
                </div>
                {waPrefs.isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              </div>
            </CardHeader>
            <CardContent className="space-y-0 pt-0">
              {waPrefs.isLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-0 divide-y divide-border/50">
                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <Zap className="w-4 h-4 text-green-500" />
                      <div>
                        <Label htmlFor="waChargeStart" className="text-sm cursor-pointer">Inicio de carga</Label>
                        <p className="text-xs text-muted-foreground">Cuando comienza tu sesión de carga</p>
                      </div>
                    </div>
                    <Switch
                      id="waChargeStart"
                      checked={waPrefs.data?.waNotifyChargeStart ?? true}
                      onCheckedChange={() => handleWaToggle("waNotifyChargeStart")}
                      disabled={updateWaMut.isPending}
                    />
                  </div>

                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <BellRing className="w-4 h-4 text-green-500" />
                      <div>
                        <Label htmlFor="waChargeEnd" className="text-sm cursor-pointer">Fin de carga</Label>
                        <p className="text-xs text-muted-foreground">Resumen al completar la sesión</p>
                      </div>
                    </div>
                    <Switch
                      id="waChargeEnd"
                      checked={waPrefs.data?.waNotifyChargeEnd ?? true}
                      onCheckedChange={() => handleWaToggle("waNotifyChargeEnd")}
                      disabled={updateWaMut.isPending}
                    />
                  </div>

                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <Bell className="w-4 h-4 text-yellow-500" />
                      <div>
                        <Label htmlFor="waReminder" className="text-sm cursor-pointer">
                          Recordatorio habitual
                        </Label>
                        <p className="text-xs text-muted-foreground">Aviso si llevas días sin cargar</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs text-muted-foreground hidden sm:flex">
                        Desactivado por defecto
                      </Badge>
                      <Switch
                        id="waReminder"
                        checked={waPrefs.data?.waNotifyReminder ?? false}
                        onCheckedChange={() => handleWaToggle("waNotifyReminder")}
                        disabled={updateWaMut.isPending}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <ShieldAlert className="w-4 h-4 text-red-500" />
                      <div>
                        <Label htmlFor="waPenalty" className="text-sm cursor-pointer">Penalizaciones</Label>
                        <p className="text-xs text-muted-foreground">Alertas de tarifa de ocupación activa</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-600/30 hidden sm:flex">
                        Recomendado
                      </Badge>
                      <Switch
                        id="waPenalty"
                        checked={waPrefs.data?.waNotifyPenalty ?? true}
                        onCheckedChange={() => handleWaToggle("waNotifyPenalty")}
                        disabled={updateWaMut.isPending}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <Wallet className="w-4 h-4 text-blue-500" />
                      <div>
                        <Label htmlFor="waWallet" className="text-sm cursor-pointer">Billetera y pagos</Label>
                        <p className="text-xs text-muted-foreground">Recargas, pagos y movimientos</p>
                      </div>
                    </div>
                    <Switch
                      id="waWallet"
                      checked={waPrefs.data?.waNotifyWallet ?? true}
                      onCheckedChange={() => handleWaToggle("waNotifyWallet")}
                      disabled={updateWaMut.isPending}
                    />
                  </div>
                </div>
              )}

              <div className="mt-3 rounded-lg bg-green-500/5 border border-green-500/10 p-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <span className="font-medium text-green-500">Nota:</span> Estas preferencias solo aplican si tienes un número de WhatsApp registrado en tu perfil. El administrador también puede activar o desactivar las notificaciones globalmente.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Email Notifications — conectado al backend */}
          <Card className="border-blue-500/20">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-blue-500" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base">Correo Electrónico</CardTitle>
                  <CardDescription>
                    {emailEnabled ? "Notificaciones por email activas" : "Notificaciones por email desactivadas"}
                  </CardDescription>
                </div>
                {emailPrefs.isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                ) : (
                  <Switch
                    checked={emailEnabled}
                    onCheckedChange={() => handleEmailToggle("emailNotifyEnabled")}
                    disabled={updateEmailMut.isPending}
                  />
                )}
              </div>
            </CardHeader>
            {emailEnabled && !emailPrefs.isLoading && (
              <CardContent className="space-y-0 pt-0 divide-y divide-border/50">
                <div className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-blue-500" />
                    <div>
                      <Label htmlFor="emailReceipts" className="text-sm cursor-pointer">Recibos de carga</Label>
                      <p className="text-xs text-muted-foreground">Comprobante al finalizar cada sesión</p>
                    </div>
                  </div>
                  <Switch
                    id="emailReceipts"
                    checked={emailPrefs.data?.emailNotifyReceipts ?? true}
                    onCheckedChange={() => handleEmailToggle("emailNotifyReceipts")}
                    disabled={updateEmailMut.isPending}
                  />
                </div>

                <div className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-4 h-4 text-purple-500" />
                    <div>
                      <Label htmlFor="emailWeeklyReport" className="text-sm cursor-pointer">Reporte semanal de uso</Label>
                      <p className="text-xs text-muted-foreground">Resumen de consumo y gastos cada semana</p>
                    </div>
                  </div>
                  <Switch
                    id="emailWeeklyReport"
                    checked={emailPrefs.data?.emailNotifyWeeklyReport ?? false}
                    onCheckedChange={() => handleEmailToggle("emailNotifyWeeklyReport")}
                    disabled={updateEmailMut.isPending}
                  />
                </div>

                <div className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <Tag className="w-4 h-4 text-orange-500" />
                    <div>
                      <Label htmlFor="emailPromotions" className="text-sm cursor-pointer">Promociones y novedades</Label>
                      <p className="text-xs text-muted-foreground">Ofertas especiales y actualizaciones EVGreen</p>
                    </div>
                  </div>
                  <Switch
                    id="emailPromotions"
                    checked={emailPrefs.data?.emailNotifyPromotions ?? false}
                    onCheckedChange={() => handleEmailToggle("emailNotifyPromotions")}
                    disabled={updateEmailMut.isPending}
                  />
                </div>
              </CardContent>
            )}
          </Card>

          {/* SMS Notifications */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-500/10 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-slate-400" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base">SMS</CardTitle>
                  <CardDescription>Mensajes de texto — próximamente</CardDescription>
                </div>
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  Próximamente
                </Badge>
              </div>
            </CardHeader>
          </Card>
        </div>
      </div>
    </UserLayout>
  );
}
