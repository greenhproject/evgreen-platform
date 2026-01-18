import UserLayout from "@/layouts/UserLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Bell, BellRing, Mail, MessageSquare, Zap, DollarSign, AlertTriangle } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { toast } from "sonner";

export default function UserNotifications() {
  const [, setLocation] = useLocation();
  const [settings, setSettings] = useState({
    // Notificaciones push
    pushEnabled: true,
    chargingComplete: true,
    chargingStarted: true,
    lowBattery: true,
    priceAlerts: false,
    promotions: true,
    
    // Notificaciones por email
    emailEnabled: true,
    emailReceipts: true,
    emailWeeklyReport: false,
    emailPromotions: false,
    
    // SMS
    smsEnabled: false,
    smsEmergency: true,
  });

  const handleToggle = (key: keyof typeof settings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = () => {
    toast.success("Preferencias de notificación guardadas");
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
                <div>
                  <CardTitle className="text-base">Notificaciones Push</CardTitle>
                  <CardDescription>Recibe alertas en tu dispositivo</CardDescription>
                </div>
                <Switch
                  checked={settings.pushEnabled}
                  onCheckedChange={() => handleToggle("pushEnabled")}
                  className="ml-auto"
                />
              </div>
            </CardHeader>
            {settings.pushEnabled && (
              <CardContent className="space-y-4 pt-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Zap className="w-4 h-4 text-muted-foreground" />
                    <Label htmlFor="chargingComplete" className="text-sm">Carga completada</Label>
                  </div>
                  <Switch
                    id="chargingComplete"
                    checked={settings.chargingComplete}
                    onCheckedChange={() => handleToggle("chargingComplete")}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <BellRing className="w-4 h-4 text-muted-foreground" />
                    <Label htmlFor="chargingStarted" className="text-sm">Carga iniciada</Label>
                  </div>
                  <Switch
                    id="chargingStarted"
                    checked={settings.chargingStarted}
                    onCheckedChange={() => handleToggle("chargingStarted")}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                    <Label htmlFor="lowBattery" className="text-sm">Batería baja del vehículo</Label>
                  </div>
                  <Switch
                    id="lowBattery"
                    checked={settings.lowBattery}
                    onCheckedChange={() => handleToggle("lowBattery")}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                    <Label htmlFor="priceAlerts" className="text-sm">Alertas de precios bajos</Label>
                  </div>
                  <Switch
                    id="priceAlerts"
                    checked={settings.priceAlerts}
                    onCheckedChange={() => handleToggle("priceAlerts")}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="w-4 h-4 text-muted-foreground" />
                    <Label htmlFor="promotions" className="text-sm">Promociones y ofertas</Label>
                  </div>
                  <Switch
                    id="promotions"
                    checked={settings.promotions}
                    onCheckedChange={() => handleToggle("promotions")}
                  />
                </div>
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
                  checked={settings.emailEnabled}
                  onCheckedChange={() => handleToggle("emailEnabled")}
                  className="ml-auto"
                />
              </div>
            </CardHeader>
            {settings.emailEnabled && (
              <CardContent className="space-y-4 pt-0">
                <div className="flex items-center justify-between">
                  <Label htmlFor="emailReceipts" className="text-sm">Recibos de carga</Label>
                  <Switch
                    id="emailReceipts"
                    checked={settings.emailReceipts}
                    onCheckedChange={() => handleToggle("emailReceipts")}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="emailWeeklyReport" className="text-sm">Reporte semanal de uso</Label>
                  <Switch
                    id="emailWeeklyReport"
                    checked={settings.emailWeeklyReport}
                    onCheckedChange={() => handleToggle("emailWeeklyReport")}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="emailPromotions" className="text-sm">Promociones y novedades</Label>
                  <Switch
                    id="emailPromotions"
                    checked={settings.emailPromotions}
                    onCheckedChange={() => handleToggle("emailPromotions")}
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
                  checked={settings.smsEnabled}
                  onCheckedChange={() => handleToggle("smsEnabled")}
                  className="ml-auto"
                />
              </div>
            </CardHeader>
            {settings.smsEnabled && (
              <CardContent className="space-y-4 pt-0">
                <div className="flex items-center justify-between">
                  <Label htmlFor="smsEmergency" className="text-sm">Alertas de emergencia</Label>
                  <Switch
                    id="smsEmergency"
                    checked={settings.smsEmergency}
                    onCheckedChange={() => handleToggle("smsEmergency")}
                  />
                </div>
              </CardContent>
            )}
          </Card>

          <Button className="w-full gradient-primary" onClick={handleSave}>
            Guardar preferencias
          </Button>
        </div>
      </div>
    </UserLayout>
  );
}
