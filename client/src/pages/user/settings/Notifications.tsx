import UserLayout from "@/layouts/UserLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Bell, BellRing, Mail, MessageSquare, Zap, DollarSign, AlertTriangle, Send, Loader2, MapPin, Navigation } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useState } from "react";
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

  const handleProximityToggle = async () => {
    const newValue = !(proximityPrefs.data?.enabled ?? true);
    updateProximityMut.mutate({ enabled: newValue });
  };

  const handleRadiusChange = (value: number[]) => {
    updateProximityMut.mutate({ radiusKm: value[0] });
  };

  // Estado local para preferencias de email y SMS (no conectadas a backend aún)
  const [localSettings, setLocalSettings] = useState({
    emailEnabled: true,
    emailReceipts: true,
    emailWeeklyReport: false,
    emailPromotions: false,
    smsEnabled: false,
    smsEmergency: true,
  });

  const handleLocalToggle = (key: keyof typeof localSettings) => {
    setLocalSettings(prev => ({ ...prev, [key]: !prev[key] }));
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

  const handleSaveLocal = () => {
    toast.success("Preferencias de email y SMS guardadas");
  };

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

          {/* Email Notifications */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <CardTitle className="text-base">Correo Electrónico</CardTitle>
                  <CardDescription>Recibe información por email</CardDescription>
                </div>
                <Switch
                  checked={localSettings.emailEnabled}
                  onCheckedChange={() => handleLocalToggle("emailEnabled")}
                  className="ml-auto"
                />
              </div>
            </CardHeader>
            {localSettings.emailEnabled && (
              <CardContent className="space-y-4 pt-0">
                <div className="flex items-center justify-between">
                  <Label htmlFor="emailReceipts" className="text-sm">Recibos de carga</Label>
                  <Switch
                    id="emailReceipts"
                    checked={localSettings.emailReceipts}
                    onCheckedChange={() => handleLocalToggle("emailReceipts")}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="emailWeeklyReport" className="text-sm">Reporte semanal de uso</Label>
                  <Switch
                    id="emailWeeklyReport"
                    checked={localSettings.emailWeeklyReport}
                    onCheckedChange={() => handleLocalToggle("emailWeeklyReport")}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="emailPromotions" className="text-sm">Promociones y novedades</Label>
                  <Switch
                    id="emailPromotions"
                    checked={localSettings.emailPromotions}
                    onCheckedChange={() => handleLocalToggle("emailPromotions")}
                  />
                </div>
              </CardContent>
            )}
          </Card>

          {/* SMS Notifications */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <CardTitle className="text-base">SMS</CardTitle>
                  <CardDescription>Mensajes de texto importantes</CardDescription>
                </div>
                <Switch
                  checked={localSettings.smsEnabled}
                  onCheckedChange={() => handleLocalToggle("smsEnabled")}
                  className="ml-auto"
                />
              </div>
            </CardHeader>
            {localSettings.smsEnabled && (
              <CardContent className="space-y-4 pt-0">
                <div className="flex items-center justify-between">
                  <Label htmlFor="smsEmergency" className="text-sm">Alertas de emergencia</Label>
                  <Switch
                    id="smsEmergency"
                    checked={localSettings.smsEmergency}
                    onCheckedChange={() => handleLocalToggle("smsEmergency")}
                  />
                </div>
              </CardContent>
            )}
          </Card>

          <Button className="w-full gradient-primary" onClick={handleSaveLocal}>
            Guardar preferencias
          </Button>
        </div>
      </div>
    </UserLayout>
  );
}
