import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { 
  Bell, 
  Send, 
  Users,
  AlertTriangle,
  Info,
  CheckCircle,
  Megaphone
} from "lucide-react";
import { toast } from "sonner";

// Tipos de notificaciones
const NOTIFICATION_TYPES = [
  { value: "INFO", label: "Información", icon: Info, color: "text-blue-500" },
  { value: "SUCCESS", label: "Éxito", icon: CheckCircle, color: "text-green-500" },
  { value: "WARNING", label: "Advertencia", icon: AlertTriangle, color: "text-yellow-500" },
  { value: "ALERT", label: "Alerta", icon: AlertTriangle, color: "text-red-500" },
  { value: "PROMOTION", label: "Promoción", icon: Megaphone, color: "text-purple-500" },
];

const TARGET_AUDIENCES = [
  { value: "all", label: "Todos los usuarios" },
  { value: "users", label: "Solo clientes" },
  { value: "investors", label: "Solo inversionistas" },
  { value: "technicians", label: "Solo técnicos" },
];

export default function AdminNotifications() {
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    message: "",
    type: "INFO",
    targetAudience: "all",
    linkUrl: "",
  });

  // Obtener estadísticas de notificaciones (simulado por ahora)
  const stats = {
    totalSent: 1250,
    readRate: 78.5,
    activeUsers: 342,
    pendingNotifications: 15,
  };

  const handleSendNotification = async () => {
    if (!formData.title || !formData.message) {
      toast.error("Título y mensaje son obligatorios");
      return;
    }

    // TODO: Implementar envío masivo de notificaciones
    toast.success(`Notificación enviada a ${formData.targetAudience === "all" ? "todos los usuarios" : formData.targetAudience}`);
    setShowSendDialog(false);
    setFormData({
      title: "",
      message: "",
      type: "INFO",
      targetAudience: "all",
      linkUrl: "",
    });
  };

  const getTypeIcon = (type: string) => {
    const typeConfig = NOTIFICATION_TYPES.find(t => t.value === type);
    if (!typeConfig) return <Info className="w-4 h-4" />;
    const Icon = typeConfig.icon;
    return <Icon className={`w-4 h-4 ${typeConfig.color}`} />;
  };

  // Historial de notificaciones enviadas (simulado)
  const sentNotifications = [
    {
      id: 1,
      title: "Nuevo cargador disponible",
      message: "Hemos instalado un nuevo cargador en Mosquera. ¡Pruébalo!",
      type: "INFO",
      targetAudience: "all",
      sentAt: new Date(Date.now() - 86400000),
      readCount: 245,
      totalSent: 342,
    },
    {
      id: 2,
      title: "Mantenimiento programado",
      message: "El cargador GEV-001 estará en mantenimiento el 20 de enero.",
      type: "WARNING",
      targetAudience: "users",
      sentAt: new Date(Date.now() - 172800000),
      readCount: 189,
      totalSent: 256,
    },
    {
      id: 3,
      title: "¡Promoción especial!",
      message: "20% de descuento en tu próxima carga. Usa el código GREENEV20.",
      type: "PROMOTION",
      targetAudience: "all",
      sentAt: new Date(Date.now() - 259200000),
      readCount: 312,
      totalSent: 342,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Centro de Notificaciones</h1>
          <p className="text-muted-foreground">
            Envía notificaciones push a los usuarios de la plataforma
          </p>
        </div>
        <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
          <DialogTrigger asChild>
            <Button>
              <Send className="w-4 h-4 mr-2" />
              Enviar notificación
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Enviar notificación masiva</DialogTitle>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Título *</Label>
                <Input 
                  placeholder="Título de la notificación" 
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label>Mensaje *</Label>
                <Textarea 
                  placeholder="Escribe el mensaje de la notificación..."
                  rows={4}
                  value={formData.message}
                  onChange={(e) => setFormData({...formData, message: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select 
                    value={formData.type} 
                    onValueChange={(value) => setFormData({...formData, type: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NOTIFICATION_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          <div className="flex items-center gap-2">
                            <t.icon className={`w-4 h-4 ${t.color}`} />
                            {t.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Audiencia</Label>
                  <Select 
                    value={formData.targetAudience} 
                    onValueChange={(value) => setFormData({...formData, targetAudience: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TARGET_AUDIENCES.map((a) => (
                        <SelectItem key={a.value} value={a.value}>
                          {a.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>URL de destino (opcional)</Label>
                <Input 
                  placeholder="https://ejemplo.com/promocion" 
                  value={formData.linkUrl}
                  onChange={(e) => setFormData({...formData, linkUrl: e.target.value})}
                />
                <p className="text-xs text-muted-foreground">
                  Si se incluye, el usuario será redirigido al hacer clic en la notificación
                </p>
              </div>

              {/* Vista previa */}
              <div className="space-y-2">
                <Label>Vista previa</Label>
                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-start gap-3">
                    {getTypeIcon(formData.type)}
                    <div className="flex-1">
                      <div className="font-medium">{formData.title || "Título de la notificación"}</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {formData.message || "Mensaje de la notificación..."}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowSendDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSendNotification}>
                <Send className="w-4 h-4 mr-2" />
                Enviar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bell className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.totalSent.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Total enviadas</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.readRate}%</div>
              <div className="text-sm text-muted-foreground">Tasa de lectura</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.activeUsers}</div>
              <div className="text-sm text-muted-foreground">Usuarios activos</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.pendingNotifications}</div>
              <div className="text-sm text-muted-foreground">Pendientes</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Historial de notificaciones */}
      <Card>
        <div className="p-4 border-b">
          <h2 className="font-semibold">Historial de notificaciones enviadas</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Notificación</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Audiencia</TableHead>
              <TableHead>Enviada</TableHead>
              <TableHead>Leídas</TableHead>
              <TableHead>Tasa</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sentNotifications.map((notification) => (
              <TableRow key={notification.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">{notification.title}</div>
                    <div className="text-sm text-muted-foreground line-clamp-1">
                      {notification.message}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getTypeIcon(notification.type)}
                    <span className="text-sm">
                      {NOTIFICATION_TYPES.find(t => t.value === notification.type)?.label}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {TARGET_AUDIENCES.find(a => a.value === notification.targetAudience)?.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  {notification.sentAt.toLocaleDateString("es-CO", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </TableCell>
                <TableCell>
                  {notification.readCount} / {notification.totalSent}
                </TableCell>
                <TableCell>
                  <Badge className={
                    (notification.readCount / notification.totalSent) > 0.7 
                      ? "bg-green-500" 
                      : (notification.readCount / notification.totalSent) > 0.4 
                        ? "bg-yellow-500" 
                        : "bg-red-500"
                  }>
                    {((notification.readCount / notification.totalSent) * 100).toFixed(1)}%
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
