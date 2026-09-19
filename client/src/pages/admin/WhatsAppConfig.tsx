import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  MessageCircle, Settings, Send, CheckCircle, XCircle, Loader2,
  Eye, EyeOff, RefreshCw, Zap, Bell, CreditCard, AlertTriangle,
  Wifi, Calendar, BarChart3, Copy, Phone
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

// ─── Notification type definitions ────────────────────────────────────────────
const NOTIFICATION_TYPES = [
  {
    key: "notifyChargeStart",
    label: "Inicio de carga",
    description: "Cuando el usuario conecta su vehículo y la carga comienza",
    icon: Zap,
    color: "text-green-400",
    event: "charge_start",
  },
  {
    key: "notifyChargeEnd",
    label: "Fin de carga",
    description: "Cuando la sesión de carga finaliza con resumen de kWh y costo",
    icon: CheckCircle,
    color: "text-blue-400",
    event: "charge_end",
  },
  {
    key: "notifyChargeProgress",
    label: "Progreso de carga",
    description: "Actualizaciones periódicas durante la carga (cada 25%)",
    icon: BarChart3,
    color: "text-cyan-400",
    event: "charge_progress",
  },
  {
    key: "notifyPenalty",
    label: "Penalizaciones",
    description: "Cuando se aplica una tarifa de ocupación por overstay",
    icon: AlertTriangle,
    color: "text-yellow-400",
    event: "penalty",
  },
  {
    key: "notifyWalletRecharge",
    label: "Recarga de billetera",
    description: "Confirmación cuando el usuario recarga su saldo EVGreen",
    icon: CreditCard,
    color: "text-purple-400",
    event: "wallet_recharge",
  },
  {
    key: "notifyChargerOffline",
    label: "Cargador desconectado",
    description: "Alerta cuando un cargador pierde conexión OCPP",
    icon: Wifi,
    color: "text-red-400",
    event: "charger_offline",
  },
  {
    key: "notifyReservation",
    label: "Ciclo de reservas",
    description: "Confirmación, recordatorios, uso, cancelación y no presentación",
    icon: Calendar,
    color: "text-orange-400",
    event: "reservation_confirmed",
  },
  {
    key: "notifyMonthlySummary",
    label: "Resumen mensual",
    description: "Resumen de sesiones, kWh y gasto total del mes",
    icon: BarChart3,
    color: "text-indigo-400",
    event: "monthly_summary",
  },
  {
    key: "notifyStationAvailable",
    label: "Conector disponible",
    description: "Alerta solicitada por el usuario cuando un conector compatible queda libre",
    icon: Bell,
    color: "text-cyan-400",
    event: "station_available",
  },
];

export default function WhatsAppConfig() {
  const { data: config, isLoading, refetch } = trpc.whatsapp.getConfig.useQuery();
  const saveMutation = trpc.whatsapp.saveConfig.useMutation({
    onSuccess: () => { toast.success("Configuración guardada"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const testMutation = trpc.whatsapp.sendTest.useMutation({
    onSuccess: (d) => d.success ? toast.success("✅ Mensaje de prueba enviado") : toast.error("❌ Error al enviar — revisa las credenciales"),
    onError: (e) => toast.error(e.message),
  });
  const { data: logs, refetch: refetchLogs } = trpc.whatsapp.getLogs.useQuery({ limit: 50 });
  const { data: availabilityTemplate, refetch: refetchAvailabilityTemplate } = trpc.whatsapp.getStationAvailabilityTemplate.useQuery();
  const { data: reservationTemplate, refetch: refetchReservationTemplate } = trpc.whatsapp.getReservationTemplate.useQuery();
  const refreshAvailabilityTemplate = trpc.whatsapp.refreshStationAvailabilityTemplate.useMutation({
    onSuccess: (template) => {
      toast.success(template.status === "APPROVED" ? "Plantilla aprobada y lista para usar" : `Estado de plantilla: ${template.status}`);
      refetchAvailabilityTemplate();
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });
  const createAvailabilityTemplate = trpc.whatsapp.createStationAvailabilityTemplate.useMutation({
    onSuccess: (template) => {
      toast.success(template.status === "APPROVED" ? "Plantilla aprobada y lista para usar" : "Plantilla enviada a revisión de Meta");
      refetchAvailabilityTemplate();
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });
  const refreshReservationTemplate = trpc.whatsapp.refreshReservationTemplate.useMutation({
    onSuccess: (template) => {
      toast.success(template.status === "APPROVED" ? "Plantilla de reservas aprobada y lista para usar" : `Estado de plantilla de reservas: ${template.status}`);
      refetchReservationTemplate();
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });
  const createReservationTemplate = trpc.whatsapp.createReservationTemplate.useMutation({
    onSuccess: (template) => {
      toast.success(template.status === "APPROVED" ? "Plantilla de reservas aprobada y lista para usar" : "Plantilla de reservas enviada a revisión de Meta");
      refetchReservationTemplate();
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const [form, setForm] = useState({
    phoneNumberId: "",
    accessToken: "",
    wabaId: "",
    fromPhone: "",
    adminPhone: "",
    appSecret: "",
    verifyToken: "",
  });
  const [showToken, setShowToken] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [activeTab, setActiveTab] = useState<"config" | "notifications" | "logs">("config");

  // Sync form with loaded config using useEffect to avoid setState-in-render
  useEffect(() => {
    if (config) {
      setForm({
        phoneNumberId: config.phoneNumberId ?? "",
        accessToken: config.accessToken ?? "",
        wabaId: config.wabaId ?? "",
        fromPhone: config.displayPhone ?? "",
        adminPhone: config.adminPhone ?? "",
        appSecret: "",
        verifyToken: "",
      });
    }
  }, [config?.phoneNumberId, config?.accessToken, config?.wabaId, config?.displayPhone, config?.adminPhone]);

  const handleSaveCredentials = () => {
    saveMutation.mutate({
      phoneNumberId: form.phoneNumberId,
      accessToken: form.accessToken,
      wabaId: form.wabaId,
      fromPhone: form.fromPhone,
      adminPhone: form.adminPhone,
      ...(form.appSecret.trim() && { appSecret: form.appSecret.trim() }),
      ...(form.verifyToken.trim() && { verifyToken: form.verifyToken.trim() }),
    });
  };

  const handleToggleEnabled = (val: boolean) => {
    saveMutation.mutate({ enabled: val });
  };

  const handleToggleNotif = (key: string, val: boolean) => {
    saveMutation.mutate({ [key]: val } as Record<string, boolean>);
  };

  const handleSendTest = () => {
    if (!testPhone.trim()) { toast.error("Ingresa un número de teléfono"); return; }
    testMutation.mutate({ toPhone: testPhone.trim() });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-green-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">WhatsApp Notificaciones</h1>
            <p className="text-sm text-muted-foreground">Configura las notificaciones transaccionales vía WhatsApp Business API</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${config?.enabled ? "bg-green-500/20 text-green-400" : "bg-zinc-700 text-zinc-400"}`}>
            <div className={`w-2 h-2 rounded-full ${config?.enabled ? "bg-green-400 animate-pulse" : "bg-zinc-500"}`} />
            {config?.enabled ? "Activo" : "Inactivo"}
          </div>
          <Switch
            // @ts-ignore
            checked={config?.enabled ?? false}
            onCheckedChange={handleToggleEnabled}
            disabled={saveMutation.isPending}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-zinc-900 rounded-xl p-1 w-fit">
        {[
          { id: "config", label: "Credenciales", icon: Settings },
          { id: "notifications", label: "Notificaciones", icon: Bell },
          { id: "logs", label: "Historial de envíos", icon: BarChart3 },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as typeof activeTab)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === id ? "bg-green-600 text-white" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab: Credenciales */}
      {activeTab === "config" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Credentials card */}
          <Card className="p-6 space-y-5">
            <div>
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Settings className="w-4 h-4 text-green-400" />
                Credenciales WhatsApp Business API
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Obtén estas credenciales en <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="text-green-400 hover:underline">Meta for Developers</a> → Tu app → WhatsApp → API Setup
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Phone Number ID</Label>
                <Input
                  placeholder="ej: 1169338359590445"
                  value={form.phoneNumberId}
                  onChange={(e) => setForm({ ...form, phoneNumberId: e.target.value })}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">ID del número de teléfono en Meta Business</p>
              </div>

              <div className="space-y-1.5">
                <Label>Access Token (System User)</Label>
                <div className="relative">
                  <Input
                    type={showToken ? "text" : "password"}
                    placeholder="EAAxxxxxxxxxxxxxxx..."
                    value={form.accessToken}
                    onChange={(e) => setForm({ ...form, accessToken: e.target.value })}
                    className="font-mono text-sm pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">Token de System User (no expira). Nunca compartas este token.</p>
              </div>

              <div className="space-y-1.5">
                <Label>WABA ID (WhatsApp Business Account)</Label>
                <Input
                  placeholder="ej: 590534007472553"
                  value={form.wabaId}
                  onChange={(e) => setForm({ ...form, wabaId: e.target.value })}
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Número de teléfono (formato internacional)</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="ej: 573229587443"
                    value={form.fromPhone}
                    onChange={(e) => setForm({ ...form, fromPhone: e.target.value })}
                    className="pl-9 font-mono text-sm"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Sin + ni espacios. Ej: 573229587443 para +57 322 9587443</p>
              </div>

              <div className="space-y-1.5">
                <Label>Teléfono del administrador (alertas operativas)</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="ej: 573001234567"
                    value={form.adminPhone}
                    onChange={(e) => setForm({ ...form, adminPhone: e.target.value })}
                    className="pl-9 font-mono text-sm"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Recibe alertas cuando un cargador se desconecta. Sin + ni espacios.</p>
              </div>

              <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 space-y-3">
                <div>
                  <p className="text-sm font-medium text-cyan-100">Confirmación de entrega (webhook de Meta)</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Configura este endpoint y suscríbete al campo <code className="rounded bg-zinc-950 px-1">messages</code> en Meta. Así el historial diferencia “aceptado por Meta” de “entregado” o “leído”.</p>
                  <code className="mt-2 block break-all rounded bg-zinc-950 px-2 py-1.5 text-[11px] text-cyan-200">https://app.evgreen.lat/api/whatsapp/webhook</code>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>App Secret {config?.appSecretConfigured ? <span className="text-green-400">• guardado</span> : null}</Label>
                    <Input type="password" autoComplete="new-password" placeholder={config?.appSecretConfigured ? "Dejar vacío para conservar" : "App Secret de Meta"} value={form.appSecret} onChange={(e) => setForm({ ...form, appSecret: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Verify token {config?.verifyTokenConfigured ? <span className="text-green-400">• guardado</span> : null}</Label>
                    <Input type="password" autoComplete="new-password" placeholder={config?.verifyTokenConfigured ? "Dejar vacío para conservar" : "Token secreto elegido por el admin"} value={form.verifyToken} onChange={(e) => setForm({ ...form, verifyToken: e.target.value })} />
                  </div>
                </div>
              </div>
            </div>

            <Button
              onClick={handleSaveCredentials}
              disabled={saveMutation.isPending}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Guardar credenciales
            </Button>
          </Card>

          {/* Test message card */}
          <Card className="p-6 space-y-5">
            <div>
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Send className="w-4 h-4 text-blue-400" />
                Mensaje de Prueba
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Envía un mensaje de prueba para verificar que las credenciales funcionan correctamente.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Número destino (formato internacional)</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="ej: 573229587443"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  className="pl-9 font-mono text-sm"
                />
              </div>
              <p className="text-xs text-muted-foreground">El número debe tener WhatsApp activo y haber iniciado conversación con el número de negocio.</p>
            </div>

            <Button
              onClick={handleSendTest}
              disabled={testMutation.isPending || !config?.enabled}
              variant="outline"
              className="w-full"
            >
              {testMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Enviar mensaje de prueba
            </Button>

            {!config?.enabled && (
              <p className="text-xs text-yellow-500 text-center">⚠️ Activa el servicio primero para enviar mensajes de prueba</p>
            )}

            <Separator />

            {/* Current config summary */}
            <div>
              <h4 className="text-sm font-medium mb-3">Configuración actual</h4>
              <div className="space-y-2 text-sm">
                {[
                  { label: "Phone Number ID", value: config?.phoneNumberId },
                  { label: "WABA ID", value: config?.wabaId },
                  { label: "Número", value: config?.displayPhone },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-muted-foreground">{label}</span>
                    <div className="flex items-center gap-1.5">
                      <code className="text-xs bg-zinc-800 px-2 py-0.5 rounded font-mono">
                        {value || "—"}
                      </code>
                      {value && (
                        <button
                          onClick={() => { navigator.clipboard.writeText(value); toast.success("Copiado"); }}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Tab: Notificaciones */}
      {activeTab === "notifications" && (
        <Card className="p-4 sm:p-6">
          <div className="mb-6">
            <h3 className="font-semibold text-lg">Tipos de Notificación</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Activa o desactiva cada tipo de notificación. Los cambios se aplican inmediatamente.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {NOTIFICATION_TYPES.map(({ key, label, description, icon: Icon, color }) => {
              const isEnabled = config ? (config as Record<string, unknown>)[key] as boolean : false;
              return (
                <div
                  key={key}
                  className={`flex items-start gap-4 p-4 rounded-xl border transition-colors ${isEnabled ? "border-green-500/30 bg-green-500/5" : "border-zinc-800 bg-zinc-900/50"}`}
                >
                  <div className={`w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0 ${isEnabled ? "bg-green-500/20" : ""}`}>
                    <Icon className={`w-4 h-4 ${isEnabled ? color : "text-zinc-500"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm">{label}</span>
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={(val) => handleToggleNotif(key, val)}
                        disabled={saveMutation.isPending}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{description}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <Separator className="my-6" />
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="font-semibold">Plantilla de disponibilidad</h4>
                <Badge variant={availabilityTemplate?.status === "APPROVED" ? "default" : availabilityTemplate?.status === "IN_REVIEW" ? "secondary" : "outline"}>
                  {availabilityTemplate?.status === "APPROVED" ? "Aprobada por Meta" : availabilityTemplate?.status === "IN_REVIEW" ? "En revisión" : availabilityTemplate?.status || "Sin verificar"}
                </Badge>
              </div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Las alertas fuera de la ventana de conversación se envían únicamente mediante una plantilla de utilidad aprobada. La aplicación siempre conserva la alerta interna; no marca WhatsApp como entregado si Meta no lo acepta.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <code className="max-w-full break-all rounded bg-zinc-900 px-2 py-1 font-mono">{availabilityTemplate?.name || config?.stationAvailableTemplateName || "evgreen_estacion_disponible_v1"}</code>
                {availabilityTemplate?.checkedAt && <span>Verificado: {new Date(availabilityTemplate.checkedAt).toLocaleString("es-CO")}</span>}
              </div>
              {availabilityTemplate?.reason && <p className="mt-2 text-xs leading-5 text-amber-500">{availabilityTemplate.reason}</p>}
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              <Button variant="outline" size="sm" onClick={() => refreshAvailabilityTemplate.mutate()} disabled={refreshAvailabilityTemplate.isPending}>
                {refreshAvailabilityTemplate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Verificar estado
              </Button>
              {availabilityTemplate?.status === "NOT_CONFIGURED" && (
                <Button size="sm" onClick={() => createAvailabilityTemplate.mutate()} disabled={createAvailabilityTemplate.isPending || !config?.enabled} className="bg-green-600 hover:bg-green-700">
                  {createAvailabilityTemplate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageCircle className="mr-2 h-4 w-4" />}
                  Crear plantilla
                </Button>
              )}
            </div>
          </div>
          <Separator className="my-6" />
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="font-semibold">Plantilla de ciclo de reservas</h4>
                <Badge variant={reservationTemplate?.status === "APPROVED" ? "default" : reservationTemplate?.status === "IN_REVIEW" ? "secondary" : "outline"}>
                  {reservationTemplate?.status === "APPROVED" ? "Aprobada por Meta" : reservationTemplate?.status === "IN_REVIEW" ? "En revisión" : reservationTemplate?.status || "Sin verificar"}
                </Badge>
              </div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Una única plantilla Utility cubre confirmación, recordatorios de 30 y 5 minutos, uso efectivo, cancelación y no presentación. La alerta interna se conserva aun si WhatsApp sigue pendiente de aprobación.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <code className="max-w-full break-all rounded bg-zinc-900 px-2 py-1 font-mono">{reservationTemplate?.name || config?.reservationTemplateName || "evgreen_reserva_actualizacion_v1"}</code>
                {reservationTemplate?.checkedAt && <span>Verificado: {new Date(reservationTemplate.checkedAt).toLocaleString("es-CO")}</span>}
              </div>
              {reservationTemplate?.reason && <p className="mt-2 text-xs leading-5 text-amber-500">{reservationTemplate.reason}</p>}
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              <Button variant="outline" size="sm" onClick={() => refreshReservationTemplate.mutate()} disabled={refreshReservationTemplate.isPending}>
                {refreshReservationTemplate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Verificar estado
              </Button>
              {reservationTemplate?.status === "NOT_CONFIGURED" && (
                <Button size="sm" onClick={() => createReservationTemplate.mutate()} disabled={createReservationTemplate.isPending || !config?.enabled} className="bg-green-600 hover:bg-green-700">
                  {createReservationTemplate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageCircle className="mr-2 h-4 w-4" />}
                  Crear plantilla
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Tab: Logs */}
      {activeTab === "logs" && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-lg">Historial de Envíos</h3>
              <p className="text-sm text-muted-foreground mt-1">Últimos 50 mensajes enviados o intentados</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetchLogs()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualizar
            </Button>
          </div>

          {!logs || logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No hay mensajes enviados aún</p>
              <p className="text-xs mt-1">Los mensajes aparecerán aquí cuando se envíen notificaciones</p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => {
                const notifType = NOTIFICATION_TYPES.find((n) => n.event === log.eventType);
                const Icon = notifType?.icon ?? MessageCircle;
                const statusLabel = log.status === "sent" ? "Aceptado por Meta" : log.status === "delivered" ? "Entregado" : log.status === "read" ? "Leído" : "Error";
                const isFailure = log.status === "failed";
                return (
                  <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isFailure ? "bg-red-500/20" : "bg-green-500/20"}`}>
                      <Icon className={`w-4 h-4 ${isFailure ? "text-red-400" : "text-green-400"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{notifType?.label ?? log.eventType}</span>
                        <Badge variant={isFailure ? "destructive" : "default"} className="text-xs">
                          {statusLabel}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-mono">→ {log.toPhone}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{log.messageBody}</p>
                      {log.errorMessage && (
                        <p className="text-xs text-red-400 mt-0.5">{log.errorMessage}</p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {log.createdAt ? new Date(log.createdAt).toLocaleString("es-CO", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
