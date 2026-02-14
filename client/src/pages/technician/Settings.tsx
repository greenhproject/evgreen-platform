import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Bell, 
  User, 
  Shield, 
  Smartphone,
  Mail,
  Clock,
  Wrench,
  Save,
  Loader2,
  ShieldCheck,
  ShieldOff,
  Monitor,
  Tablet,
  LogOut,
  Copy,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

// ============================================================================
// Componente de configuración 2FA
// ============================================================================

function TwoFactorSetup() {
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [verifyCode, setVerifyCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [copiedSecret, setCopiedSecret] = useState(false);

  const utils = trpc.useUtils();
  const { data: status, isLoading: statusLoading } = trpc.security.get2FAStatus.useQuery();
  
  const setupMutation = trpc.security.setup2FA.useMutation({
    onError: (err) => toast.error("Error al configurar 2FA: " + err.message),
  });

  const verifyMutation = trpc.security.verify2FA.useMutation({
    onSuccess: () => {
      toast.success("Autenticación de dos factores activada");
      setShowSetupDialog(false);
      setVerifyCode("");
      utils.security.get2FAStatus.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const disableMutation = trpc.security.disable2FA.useMutation({
    onSuccess: () => {
      toast.success("2FA desactivado");
      setShowDisableDialog(false);
      setDisableCode("");
      utils.security.get2FAStatus.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleStartSetup = async () => {
    setShowSetupDialog(true);
    setupMutation.mutate();
  };

  const handleCopySecret = () => {
    if (setupMutation.data?.secret) {
      navigator.clipboard.writeText(setupMutation.data.secret);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
      toast.success("Secreto copiado al portapapeles");
    }
  };

  if (statusLoading) {
    return <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />;
  }

  return (
    <>
      <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
        <div className="flex items-center gap-3">
          {status?.enabled ? (
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
          ) : (
            <ShieldOff className="w-5 h-5 text-muted-foreground" />
          )}
          <div>
            <p className="font-medium">Autenticación de dos factores (2FA)</p>
            <p className="text-sm text-muted-foreground">
              {status?.enabled 
                ? `Activado desde ${status.verifiedAt ? new Date(status.verifiedAt).toLocaleDateString("es-CO") : "N/A"}`
                : "Agrega una capa extra de seguridad a tu cuenta"
              }
            </p>
          </div>
        </div>
        {status?.enabled ? (
          <Button 
            variant="outline" 
            size="sm"
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={() => setShowDisableDialog(true)}
          >
            Desactivar
          </Button>
        ) : (
          <Button size="sm" className="gradient-primary" onClick={handleStartSetup}>
            Activar 2FA
          </Button>
        )}
      </div>

      {/* Dialog de configuración 2FA */}
      <Dialog open={showSetupDialog} onOpenChange={setShowSetupDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
              Configurar 2FA
            </DialogTitle>
            <DialogDescription>
              Escanea el código QR con tu app de autenticación (Google Authenticator, Authy, etc.)
            </DialogDescription>
          </DialogHeader>

          {setupMutation.isPending ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
          ) : setupMutation.data ? (
            <div className="space-y-4">
              {/* QR Code */}
              <div className="flex justify-center">
                <div className="p-4 bg-white rounded-lg border">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(setupMutation.data.otpauthUrl)}`}
                    alt="QR Code 2FA"
                    className="w-48 h-48"
                  />
                </div>
              </div>

              {/* Secreto manual */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Si no puedes escanear el QR, ingresa este código manualmente:
                </Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2 bg-muted rounded text-xs font-mono break-all">
                    {setupMutation.data.secret}
                  </code>
                  <Button variant="outline" size="icon" onClick={handleCopySecret}>
                    {copiedSecret ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              {/* Verificación */}
              <div className="space-y-2">
                <Label>Ingresa el código de 6 dígitos de tu app:</Label>
                <Input
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  className="text-center text-lg tracking-widest font-mono"
                  maxLength={6}
                />
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSetupDialog(false)}>
              Cancelar
            </Button>
            <Button
              className="gradient-primary"
              disabled={verifyCode.length !== 6 || verifyMutation.isPending}
              onClick={() => verifyMutation.mutate({ token: verifyCode })}
            >
              {verifyMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Verificar y activar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de desactivación 2FA */}
      <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Desactivar 2FA
            </DialogTitle>
            <DialogDescription>
              Ingresa un código de tu app de autenticación para confirmar la desactivación.
              Tu cuenta será menos segura sin 2FA.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label>Código de verificación:</Label>
            <Input
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className="text-center text-lg tracking-widest font-mono"
              maxLength={6}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDisableDialog(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={disableCode.length !== 6 || disableMutation.isPending}
              onClick={() => disableMutation.mutate({ token: disableCode })}
            >
              {disableMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Desactivar 2FA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================================================
// Componente de historial de sesiones
// ============================================================================

function SessionHistory() {
  const [showAll, setShowAll] = useState(false);
  const utils = trpc.useUtils();
  
  const { data: sessions, isLoading } = trpc.security.getSessions.useQuery(
    { limit: showAll ? 50 : 10 }
  );

  const terminateMutation = trpc.security.terminateSession.useMutation({
    onSuccess: () => {
      toast.success("Sesión cerrada");
      utils.security.getSessions.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const terminateAllMutation = trpc.security.terminateAllOtherSessions.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.terminated} sesiones cerradas`);
      utils.security.getSessions.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const getDeviceIcon = (deviceType: string | null) => {
    switch (deviceType) {
      case "mobile": return <Smartphone className="w-4 h-4" />;
      case "tablet": return <Tablet className="w-4 h-4" />;
      default: return <Monitor className="w-4 h-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!sessions || sessions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Monitor className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No hay sesiones registradas aún</p>
      </div>
    );
  }

  const activeSessions = sessions.filter(s => s.isActive);

  return (
    <div className="space-y-3">
      {/* Resumen */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {activeSessions.length} sesión(es) activa(s) de {sessions.length} total
        </p>
        {activeSessions.length > 1 && (
          <Button 
            variant="outline" 
            size="sm"
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={() => terminateAllMutation.mutate()}
            disabled={terminateAllMutation.isPending}
          >
            {terminateAllMutation.isPending ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <LogOut className="w-3 h-3 mr-1" />
            )}
            Cerrar todas las demás
          </Button>
        )}
      </div>

      {/* Lista de sesiones */}
      <div className="space-y-2">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={`flex items-center justify-between p-3 rounded-lg border ${
              session.isActive ? "bg-card border-emerald-500/20" : "bg-muted/50"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${session.isActive ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"}`}>
                {getDeviceIcon(session.deviceType)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">
                    {session.browser || "Navegador desconocido"} - {session.os || "SO desconocido"}
                  </p>
                  {session.isActive && (
                    <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 text-[10px] px-1.5 py-0">
                      Activa
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {session.ipAddress && `IP: ${session.ipAddress} · `}
                  {new Date(session.loginAt).toLocaleString("es-CO", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </div>
            </div>
            {session.isActive && (
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => terminateMutation.mutate({ sessionId: session.id })}
                disabled={terminateMutation.isPending}
              >
                <XCircle className="w-4 h-4" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {sessions.length >= 10 && !showAll && (
        <Button variant="ghost" size="sm" className="w-full" onClick={() => setShowAll(true)}>
          Ver más sesiones
        </Button>
      )}
    </div>
  );
}

// ============================================================================
// Componente principal
// ============================================================================

export default function TechnicianSettings() {
  const { user } = useAuth();
  const [hasChanges, setHasChanges] = useState(false);
  
  const [settings, setSettings] = useState({
    notifyNewTickets: true,
    notifyCriticalAlerts: true,
    notifyMaintenanceReminders: true,
    notifyByEmail: true,
    notifyByPush: true,
    defaultView: "dashboard",
    autoRefreshLogs: true,
    refreshInterval: "30",
    availableForEmergencies: true,
    workingHoursStart: "08:00",
    workingHoursEnd: "18:00",
  });

  // Cargar configuración del backend
  const { data: savedConfig, isLoading } = trpc.techConfig.get.useQuery();

  const utils = trpc.useUtils();
  const saveMutation = trpc.techConfig.save.useMutation({
    onSuccess: () => {
      toast.success("Configuración guardada correctamente");
      setHasChanges(false);
      utils.techConfig.get.invalidate();
    },
    onError: (err) => toast.error("Error al guardar: " + err.message),
  });

  // Registrar sesión al cargar la página
  const recordSessionMutation = trpc.security.recordSession.useMutation();
  const [sessionRecorded] = useState(() => {
    // Solo registrar una vez
    return false;
  });
  
  useEffect(() => {
    if (user && !sessionRecorded) {
      recordSessionMutation.mutate({
        userAgent: navigator.userAgent,
      });
    }
  }, [user?.id]);

  // Cargar datos del backend cuando estén disponibles
  useEffect(() => {
    if (savedConfig) {
      setSettings({
        notifyNewTickets: savedConfig.notifyNewTickets ?? true,
        notifyCriticalAlerts: savedConfig.notifyCriticalAlerts ?? true,
        notifyMaintenanceReminders: savedConfig.notifyMaintenanceReminders ?? true,
        notifyByEmail: savedConfig.notifyByEmail ?? true,
        notifyByPush: savedConfig.notifyByPush ?? true,
        defaultView: savedConfig.defaultView || "dashboard",
        autoRefreshLogs: savedConfig.autoRefreshLogs ?? true,
        refreshInterval: String(savedConfig.refreshInterval || 30),
        availableForEmergencies: savedConfig.availableForEmergencies ?? true,
        workingHoursStart: savedConfig.workingHoursStart || "08:00",
        workingHoursEnd: savedConfig.workingHoursEnd || "18:00",
      });
    }
  }, [savedConfig]);

  const handleToggle = (key: keyof typeof settings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    setHasChanges(true);
  };

  const handleChange = (key: keyof typeof settings, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    const payload = {
      notifyNewTickets: Boolean(settings.notifyNewTickets),
      notifyCriticalAlerts: Boolean(settings.notifyCriticalAlerts),
      notifyMaintenanceReminders: Boolean(settings.notifyMaintenanceReminders),
      notifyByEmail: Boolean(settings.notifyByEmail),
      notifyByPush: Boolean(settings.notifyByPush),
      defaultView: settings.defaultView as "dashboard" | "tickets" | "alerts" | "stations",
      autoRefreshLogs: Boolean(settings.autoRefreshLogs),
      refreshInterval: parseInt(settings.refreshInterval) || 30,
      availableForEmergencies: Boolean(settings.availableForEmergencies),
      workingHoursStart: settings.workingHoursStart || "08:00",
      workingHoursEnd: settings.workingHoursEnd || "18:00",
    };
    saveMutation.mutate(payload);
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Configuración</h1>
          <p className="text-muted-foreground">
            Personaliza tu experiencia como técnico
          </p>
        </div>
        <Button 
          onClick={handleSave} 
          className="gradient-primary"
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Guardar cambios
        </Button>
      </div>

      {/* Perfil */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Perfil de Técnico
          </CardTitle>
          <CardDescription>
            Información de tu cuenta
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-2xl font-bold text-primary">
              {user?.name?.charAt(0) || "T"}
            </div>
            <div>
              <h3 className="font-semibold">{user?.name || "Técnico"}</h3>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <p className="text-sm text-muted-foreground">Rol: Técnico de Soporte</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notificaciones */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notificaciones
          </CardTitle>
          <CardDescription>
            Configura qué alertas deseas recibir
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Nuevos tickets asignados</Label>
              <p className="text-sm text-muted-foreground">Recibir alerta cuando te asignen un ticket</p>
            </div>
            <Switch
              checked={settings.notifyNewTickets}
              onCheckedChange={() => handleToggle("notifyNewTickets")}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Alertas críticas</Label>
              <p className="text-sm text-muted-foreground">Notificaciones de emergencia de estaciones</p>
            </div>
            <Switch
              checked={settings.notifyCriticalAlerts}
              onCheckedChange={() => handleToggle("notifyCriticalAlerts")}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Recordatorios de mantenimiento</Label>
              <p className="text-sm text-muted-foreground">Alertas de tareas programadas</p>
            </div>
            <Switch
              checked={settings.notifyMaintenanceReminders}
              onCheckedChange={() => handleToggle("notifyMaintenanceReminders")}
            />
          </div>
          <div className="border-t pt-4 mt-4">
            <h4 className="font-medium mb-3">Canales de notificación</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <Label>Correo electrónico</Label>
                </div>
                <Switch
                  checked={settings.notifyByEmail}
                  onCheckedChange={() => handleToggle("notifyByEmail")}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-muted-foreground" />
                  <Label>Notificaciones push</Label>
                </div>
                <Switch
                  checked={settings.notifyByPush}
                  onCheckedChange={() => handleToggle("notifyByPush")}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preferencias de trabajo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="w-5 h-5" />
            Preferencias de Trabajo
          </CardTitle>
          <CardDescription>
            Personaliza tu entorno de trabajo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Vista por defecto</Label>
            <Select 
              value={settings.defaultView} 
              onValueChange={(v) => handleChange("defaultView", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dashboard">Dashboard</SelectItem>
                <SelectItem value="tickets">Tickets</SelectItem>
                <SelectItem value="alerts">Alertas</SelectItem>
                <SelectItem value="stations">Estaciones</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-actualizar logs OCPP</Label>
              <p className="text-sm text-muted-foreground">Actualizar automáticamente los logs en tiempo real</p>
            </div>
            <Switch
              checked={settings.autoRefreshLogs}
              onCheckedChange={() => handleToggle("autoRefreshLogs")}
            />
          </div>
          {settings.autoRefreshLogs && (
            <div className="space-y-2">
              <Label>Intervalo de actualización</Label>
              <Select 
                value={settings.refreshInterval} 
                onValueChange={(v) => handleChange("refreshInterval", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">Cada 10 segundos</SelectItem>
                  <SelectItem value="30">Cada 30 segundos</SelectItem>
                  <SelectItem value="60">Cada minuto</SelectItem>
                  <SelectItem value="300">Cada 5 minutos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Disponibilidad */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Disponibilidad
          </CardTitle>
          <CardDescription>
            Configura tu horario y disponibilidad
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Disponible para emergencias</Label>
              <p className="text-sm text-muted-foreground">Recibir alertas fuera del horario laboral</p>
            </div>
            <Switch
              checked={settings.availableForEmergencies}
              onCheckedChange={() => handleToggle("availableForEmergencies")}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Hora de inicio</Label>
              <Input
                type="time"
                value={settings.workingHoursStart}
                onChange={(e) => handleChange("workingHoursStart", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Hora de fin</Label>
              <Input
                type="time"
                value={settings.workingHoursEnd}
                onChange={(e) => handleChange("workingHoursEnd", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seguridad */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Seguridad
          </CardTitle>
          <CardDescription>
            Protege tu cuenta con autenticación de dos factores y gestiona tus sesiones activas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 2FA */}
          <div>
            <h4 className="font-medium mb-3 text-sm text-muted-foreground uppercase tracking-wider">
              Autenticación de dos factores
            </h4>
            <TwoFactorSetup />
          </div>

          {/* Sesiones */}
          <div className="border-t pt-6">
            <h4 className="font-medium mb-3 text-sm text-muted-foreground uppercase tracking-wider">
              Historial de sesiones
            </h4>
            <SessionHistory />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
