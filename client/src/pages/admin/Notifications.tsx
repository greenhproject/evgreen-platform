import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
  Megaphone,
  Mail,
  Smartphone,
  Loader2,
  RefreshCw
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
  { value: "admins", label: "Solo administradores" },
];

export default function AdminNotifications() {
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    message: "",
    type: "INFO",
    targetAudience: "all",
    linkUrl: "",
    sendPush: true,
    sendEmail: false,
    sendInApp: true,
  });

  // Obtener estadísticas reales
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = trpc.notifications.getStats.useQuery();

  // Obtener historial real
  const { data: history, isLoading: historyLoading, refetch: refetchHistory } = trpc.notifications.getHistory.useQuery({ limit: 20 });

  // Mutación para enviar notificación
  const sendBroadcast = trpc.notifications.sendBroadcast.useMutation({
    onSuccess: (result) => {
      toast.success(
        `Notificación enviada exitosamente`,
        {
          description: `In-app: ${result.inAppCreated} | Push: ${result.pushSent} | Email: ${result.emailSent}`,
        }
      );
      setShowSendDialog(false);
      setFormData({
        title: "",
        message: "",
        type: "INFO",
        targetAudience: "all",
        linkUrl: "",
        sendPush: true,
        sendEmail: false,
        sendInApp: true,
      });
      refetchStats();
      refetchHistory();
    },
    onError: (error) => {
      toast.error("Error al enviar notificación", {
        description: error.message,
      });
    },
  });

  const handleSendNotification = async () => {
    if (!formData.title || !formData.message) {
      toast.error("Título y mensaje son obligatorios");
      return;
    }

    if (!formData.sendPush && !formData.sendEmail && !formData.sendInApp) {
      toast.error("Selecciona al menos un canal de envío");
      return;
    }

    sendBroadcast.mutate({
      title: formData.title,
      message: formData.message,
      type: formData.type as "INFO" | "SUCCESS" | "WARNING" | "ALERT" | "PROMOTION",
      targetAudience: formData.targetAudience as "all" | "users" | "investors" | "technicians" | "admins",
      linkUrl: formData.linkUrl || undefined,
      sendPush: formData.sendPush,
      sendEmail: formData.sendEmail,
      sendInApp: formData.sendInApp,
    });
  };

  const getTypeIcon = (type: string) => {
    const typeConfig = NOTIFICATION_TYPES.find(t => t.value === type);
    if (!typeConfig) return <Info className="w-4 h-4" />;
    const Icon = typeConfig.icon;
    return <Icon className={`w-4 h-4 ${typeConfig.color}`} />;
  };

  const getAudienceLabel = (audience: string) => {
    const found = TARGET_AUDIENCES.find(a => a.value === audience);
    return found?.label || audience;
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleString("es-CO", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Centro de Notificaciones</h1>
          <p className="text-muted-foreground">
            Envía notificaciones push, email y en la plataforma a los usuarios
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => { refetchStats(); refetchHistory(); }}>
            <RefreshCw className="w-4 h-4" />
          </Button>
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
                    placeholder="https://evgreen.lat/promocion" 
                    value={formData.linkUrl}
                    onChange={(e) => setFormData({...formData, linkUrl: e.target.value})}
                  />
                  <p className="text-xs text-muted-foreground">
                    Si se incluye, el usuario será redirigido al hacer clic en la notificación
                  </p>
                </div>

                {/* Canales de envío */}
                <div className="space-y-3">
                  <Label>Canales de envío</Label>
                  <div className="flex flex-wrap gap-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="sendInApp" 
                        checked={formData.sendInApp}
                        onCheckedChange={(checked) => setFormData({...formData, sendInApp: checked as boolean})}
                      />
                      <label htmlFor="sendInApp" className="text-sm flex items-center gap-1 cursor-pointer">
                        <Bell className="w-4 h-4" />
                        En la plataforma
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="sendPush" 
                        checked={formData.sendPush}
                        onCheckedChange={(checked) => setFormData({...formData, sendPush: checked as boolean})}
                      />
                      <label htmlFor="sendPush" className="text-sm flex items-center gap-1 cursor-pointer">
                        <Smartphone className="w-4 h-4" />
                        Push (móvil)
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="sendEmail" 
                        checked={formData.sendEmail}
                        onCheckedChange={(checked) => setFormData({...formData, sendEmail: checked as boolean})}
                      />
                      <label htmlFor="sendEmail" className="text-sm flex items-center gap-1 cursor-pointer">
                        <Mail className="w-4 h-4" />
                        Email
                      </label>
                    </div>
                  </div>
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
                <Button onClick={handleSendNotification} disabled={sendBroadcast.isPending}>
                  {sendBroadcast.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  {sendBroadcast.isPending ? "Enviando..." : "Enviar"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bell className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold">
                {statsLoading ? "..." : (stats?.totalSent || 0).toLocaleString()}
              </div>
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
              <div className="text-2xl font-bold">
                {statsLoading ? "..." : `${stats?.readRate || 0}%`}
              </div>
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
              <div className="text-2xl font-bold">
                {statsLoading ? "..." : (stats?.activeUsers || 0).toLocaleString()}
              </div>
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
              <div className="text-2xl font-bold">
                {statsLoading ? "..." : (stats?.pendingNotifications || 0).toLocaleString()}
              </div>
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
            {historyLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : history && history.length > 0 ? (
              history.map((notification) => (
                <TableRow key={notification.id}>
                  <TableCell>
                    <div className="max-w-xs">
                      <div className="font-medium truncate">{notification.title}</div>
                      <div className="text-sm text-muted-foreground truncate">
                        {notification.message}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getTypeIcon(notification.type)}
                      <span className="capitalize">
                        {NOTIFICATION_TYPES.find(t => t.value === notification.type)?.label || notification.type}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {getAudienceLabel(notification.targetAudience)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(notification.sentAt)}
                  </TableCell>
                  <TableCell>
                    {notification.readCount} / {notification.totalSent}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={
                        notification.totalSent > 0 
                          ? (notification.readCount / notification.totalSent) >= 0.7 
                            ? "default" 
                            : "secondary"
                          : "outline"
                      }
                    >
                      {notification.totalSent > 0 
                        ? `${Math.round((notification.readCount / notification.totalSent) * 100)}%`
                        : "—"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No hay notificaciones enviadas aún. Envía tu primera notificación.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
