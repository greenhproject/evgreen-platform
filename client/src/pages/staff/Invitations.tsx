import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Mail,
  Send,
  UserPlus,
  CheckCircle2,
  Clock,
  Eye,
  Users,
  Zap,
  RefreshCw,
  AlertCircle,
  MailCheck,
  MailX,
  MailOpen,
  MousePointerClick,
} from "lucide-react";

// Mapeo de estados de email a iconos y colores
const EMAIL_STATUS_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  not_sent: { icon: Clock, color: "text-yellow-400", label: "No enviada" },
  sent: { icon: Mail, color: "text-blue-400", label: "Enviado" },
  delivered: { icon: MailCheck, color: "text-green-400", label: "Entregado" },
  delivery_delayed: { icon: AlertCircle, color: "text-yellow-400", label: "Retrasado" },
  complained: { icon: MailX, color: "text-red-400", label: "Spam" },
  bounced: { icon: MailX, color: "text-red-400", label: "Rebotado" },
  opened: { icon: MailOpen, color: "text-emerald-400", label: "Abierto" },
  clicked: { icon: MousePointerClick, color: "text-emerald-400", label: "Clic" },
  unknown: { icon: AlertCircle, color: "text-gray-400", label: "Desconocido" },
  error: { icon: AlertCircle, color: "text-red-400", label: "Error" },
};

function EmailStatusBadge({ guestId }: { guestId: number }) {
  const statusQuery = trpc.event.checkEmailStatus.useQuery(
    { guestId },
    { enabled: false }
  );
  const [checked, setChecked] = useState(false);

  const handleCheck = () => {
    setChecked(true);
    statusQuery.refetch();
  };

  if (!checked) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCheck}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        <Eye className="h-3 w-3 mr-1" />
        Ver estado
      </Button>
    );
  }

  if (statusQuery.isLoading) {
    return <span className="text-xs text-muted-foreground animate-pulse">Verificando...</span>;
  }

  const status = statusQuery.data?.status || "unknown";
  const config = EMAIL_STATUS_CONFIG[status] || EMAIL_STATUS_CONFIG.unknown;
  const StatusIcon = config.icon;

  return (
    <Badge variant="outline" className={`${config.color} border-current/30`}>
      <StatusIcon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
}

export default function Invitations() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newGuest, setNewGuest] = useState({
    fullName: "",
    email: "",
    phone: "",
    company: "",
    position: "",
    investmentPackage: "" as string,
    notes: "",
  });

  const utils = trpc.useUtils();

  const guestsQuery = trpc.event.listGuests.useQuery({ limit: 100 });

  const createMutation = trpc.event.createGuest.useMutation({
    onSuccess: (data) => {
      toast.success(`Invitado creado. Cupo #${data.founderSlot || "N/A"}`);
      setShowCreateDialog(false);
      setNewGuest({ fullName: "", email: "", phone: "", company: "", position: "", investmentPackage: "", notes: "" });
      utils.event.listGuests.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const sendInvitationMutation = trpc.event.sendInvitation.useMutation({
    onSuccess: () => {
      toast.success("Invitación enviada exitosamente. Revisa la bandeja de entrada y la carpeta de spam del destinatario.");
      utils.event.listGuests.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const resendMutation = trpc.event.resendInvitation.useMutation({
    onSuccess: () => {
      toast.success("Invitación re-enviada exitosamente");
      utils.event.listGuests.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const sendBulkMutation = trpc.event.sendBulkInvitations.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.sent} invitaciones enviadas`);
      if (data.failed > 0) {
        toast.error(`${data.failed} invitaciones fallaron`);
      }
      utils.event.listGuests.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const guests = guestsQuery.data?.guests || [];
  const stats = guestsQuery.data?.stats;
  const pendingInvitations = guests.filter((g) => !g.invitationSentAt);
  const sentInvitations = guests.filter((g) => g.invitationSentAt);

  const handleCreate = () => {
    if (!newGuest.fullName || !newGuest.email) {
      toast.error("Nombre y email son requeridos");
      return;
    }
    createMutation.mutate({
      ...newGuest,
      investmentPackage: newGuest.investmentPackage as any || undefined,
      notes: newGuest.notes || undefined,
      phone: newGuest.phone || undefined,
      company: newGuest.company || undefined,
      position: newGuest.position || undefined,
    });
  };

  const handleSendAll = () => {
    if (pendingInvitations.length === 0) {
      toast.info("No hay invitaciones pendientes por enviar");
      return;
    }
    sendBulkMutation.mutate({
      guestIds: pendingInvitations.map((g) => g.id),
    });
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Mail className="h-6 w-6 text-green-500" />
            Invitaciones
          </h1>
          <p className="text-muted-foreground text-sm">
            Crea invitados y envía invitaciones con código QR por email
          </p>
        </div>
        <div className="flex gap-2">
          {pendingInvitations.length > 0 && (
            <Button
              variant="outline"
              onClick={handleSendAll}
              disabled={sendBulkMutation.isPending}
            >
              <Send className="mr-2 h-4 w-4" />
              Enviar Todas ({pendingInvitations.length})
            </Button>
          )}
          <Button
            className="bg-green-600 hover:bg-green-700"
            onClick={() => setShowCreateDialog(true)}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Crear y Enviar
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-border/40">
          <CardContent className="p-3 text-center">
            <Users className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
            <p className="text-2xl font-bold">{stats?.total || 0}</p>
            <p className="text-xs text-muted-foreground">Total Invitados</p>
          </CardContent>
        </Card>
        <Card className="border-green-500/20">
          <CardContent className="p-3 text-center">
            <CheckCircle2 className="h-5 w-5 text-green-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-green-400">{sentInvitations.length}</p>
            <p className="text-xs text-muted-foreground">Enviadas</p>
          </CardContent>
        </Card>
        <Card className="border-yellow-500/20">
          <CardContent className="p-3 text-center">
            <Clock className="h-5 w-5 text-yellow-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-yellow-400">{pendingInvitations.length}</p>
            <p className="text-xs text-muted-foreground">Pendientes</p>
          </CardContent>
        </Card>
      </div>

      {/* Cupos fundadores */}
      <Card className="border-green-500/20 bg-green-500/5">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                <Zap className="h-4 w-4 text-green-500" />
                Cupos Fundadores
              </h3>
              <p className="text-sm text-muted-foreground">
                {30 - (stats?.total || 0)} cupos disponibles de 30
              </p>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: 30 }, (_, i) => (
                <div
                  key={i}
                  className={`w-2 h-6 rounded-sm ${
                    i < (stats?.total || 0)
                      ? "bg-green-500"
                      : "bg-green-500/20"
                  }`}
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Nota sobre entregabilidad */}
      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardContent className="p-3">
          <p className="text-xs text-blue-300 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Si el invitado no recibe el email, pídele que revise su carpeta de <strong>Spam</strong> o <strong>Promociones</strong>.
              Puedes usar "Ver estado" para verificar si fue entregado, y "Re-enviar" si es necesario.
            </span>
          </p>
        </CardContent>
      </Card>

      {/* Pendientes de envío */}
      {pendingInvitations.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Clock className="h-5 w-5 text-yellow-400" />
            Pendientes de Envío ({pendingInvitations.length})
          </h2>
          <div className="space-y-2">
            {pendingInvitations.map((guest) => (
              <Card key={guest.id} className="border-yellow-500/10">
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{guest.fullName}</p>
                    <p className="text-sm text-muted-foreground">{guest.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {guest.founderSlot && (
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                        #{guest.founderSlot}
                      </Badge>
                    )}
                    <Button
                      size="sm"
                      onClick={() => sendInvitationMutation.mutate({ guestId: guest.id })}
                      disabled={sendInvitationMutation.isPending}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Send className="h-3 w-3 mr-1" />
                      Enviar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Enviadas */}
      {sentInvitations.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-400" />
            Invitaciones Enviadas ({sentInvitations.length})
          </h2>
          <div className="space-y-2">
            {sentInvitations.map((guest) => (
              <Card key={guest.id} className="border-green-500/10">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{guest.fullName}</p>
                      <p className="text-sm text-muted-foreground">
                        {guest.email} • {guest.invitationSentAt ? new Date(guest.invitationSentAt).toLocaleDateString("es-CO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {guest.founderSlot && (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                          #{guest.founderSlot}
                        </Badge>
                      )}
                      <EmailStatusBadge guestId={guest.id} />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm(`¿Re-enviar invitación a ${guest.fullName} (${guest.email})?`)) {
                            resendMutation.mutate({ guestId: guest.id });
                          }
                        }}
                        disabled={resendMutation.isPending}
                        className="text-xs"
                      >
                        <RefreshCw className={`h-3 w-3 mr-1 ${resendMutation.isPending ? "animate-spin" : ""}`} />
                        Re-enviar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Dialog Crear Invitado */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Crear Invitado y Enviar Invitación</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nombre Completo *</Label>
              <Input
                value={newGuest.fullName}
                onChange={(e) => setNewGuest({ ...newGuest, fullName: e.target.value })}
                placeholder="Juan Pérez"
              />
            </div>
            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                value={newGuest.email}
                onChange={(e) => setNewGuest({ ...newGuest, email: e.target.value })}
                placeholder="juan@empresa.com"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Teléfono</Label>
                <Input
                  value={newGuest.phone}
                  onChange={(e) => setNewGuest({ ...newGuest, phone: e.target.value })}
                  placeholder="+573001234567"
                />
              </div>
              <div>
                <Label>Cargo</Label>
                <Input
                  value={newGuest.position}
                  onChange={(e) => setNewGuest({ ...newGuest, position: e.target.value })}
                  placeholder="Gerente"
                />
              </div>
            </div>
            <div>
              <Label>Empresa</Label>
              <Input
                value={newGuest.company}
                onChange={(e) => setNewGuest({ ...newGuest, company: e.target.value })}
                placeholder="Empresa S.A.S."
              />
            </div>
            <div>
              <Label>Paquete de Interés</Label>
              <Select
                value={newGuest.investmentPackage}
                onValueChange={(v) => setNewGuest({ ...newGuest, investmentPackage: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar paquete" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AC">AC Básico - $8.500.000</SelectItem>
                  <SelectItem value="DC_INDIVIDUAL">DC Individual 120kW - $85.000.000</SelectItem>
                  <SelectItem value="COLECTIVO">Estación Premium Colectiva - $200.000.000</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea
                value={newGuest.notes}
                onChange={(e) => setNewGuest({ ...newGuest, notes: e.target.value })}
                placeholder="Notas adicionales..."
                rows={2}
              />
            </div>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {createMutation.isPending ? "Creando..." : "Crear Invitado"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
