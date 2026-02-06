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
} from "lucide-react";

export default function Invitations() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [previewGuest, setPreviewGuest] = useState<any>(null);
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
      toast.success("Invitación enviada exitosamente");
      utils.event.listGuests.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const sendBulkMutation = trpc.event.sendBulkInvitations.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.sent} invitaciones enviadas`);
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
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{guest.fullName}</p>
                    <p className="text-sm text-muted-foreground">
                      {guest.email} • Enviada: {guest.invitationSentAt ? new Date(guest.invitationSentAt).toLocaleDateString("es-CO") : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {guest.founderSlot && (
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                        #{guest.founderSlot}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-green-400">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Enviada
                    </Badge>
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
