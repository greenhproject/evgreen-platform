import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Bell, 
  User, 
  Shield, 
  Smartphone,
  Mail,
  Clock,
  Wrench,
  Save
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

export default function TechnicianSettings() {
  const { user } = useAuth();
  
  const [settings, setSettings] = useState({
    // Notificaciones
    notifyNewTickets: true,
    notifyCriticalAlerts: true,
    notifyMaintenanceReminders: true,
    notifyByEmail: true,
    notifyByPush: true,
    
    // Preferencias de trabajo
    defaultView: "dashboard",
    autoRefreshLogs: true,
    refreshInterval: "30",
    
    // Disponibilidad
    availableForEmergencies: true,
    workingHoursStart: "08:00",
    workingHoursEnd: "18:00",
  });

  const handleToggle = (key: keyof typeof settings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleChange = (key: keyof typeof settings, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    toast.success("Configuración guardada correctamente");
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Configuración</h1>
          <p className="text-muted-foreground">
            Personaliza tu experiencia como técnico
          </p>
        </div>
        <Button onClick={handleSave} className="gradient-primary">
          <Save className="w-4 h-4 mr-2" />
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
            Opciones de seguridad de tu cuenta
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" className="w-full justify-start">
            Cambiar contraseña
          </Button>
          <Button variant="outline" className="w-full justify-start">
            Configurar autenticación de dos factores
          </Button>
          <Button variant="outline" className="w-full justify-start">
            Ver historial de sesiones
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
