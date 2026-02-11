import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  UserPlus,
  Search,
  Mail,
  Send,
  Trash2,
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  QrCode,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  Eye,
  Shield,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const STATUS_LABELS: Record<string, string> = {
  INVITED: "Invitado",
  CONFIRMED: "Confirmado",
  CHECKED_IN: "Registrado",
  NO_SHOW: "No asistió",
  CANCELLED: "Cancelado",
};

const STATUS_COLORS: Record<string, string> = {
  INVITED: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  CONFIRMED: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  CHECKED_IN: "bg-green-500/20 text-green-400 border-green-500/30",
  NO_SHOW: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  CANCELLED: "bg-red-500/20 text-red-400 border-red-500/30",
};

const PACKAGE_LABELS: Record<string, string> = {
  AC: "AC Básico - $8.5M",
  DC_INDIVIDUAL: "DC Individual - $85M",
  COLECTIVO: "Colectivo - $200M",
};

export default function Guests() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
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

  const guestsQuery = trpc.event.listGuests.useQuery({
    search: search || undefined,
    status: statusFilter as any,
    limit: 100,
  });

  const createMutation = trpc.event.createGuest.useMutation({
    onSuccess: (data) => {
      toast.success(`Invitado creado. Cupo Fundador: #${data.founderSlot || "N/A"}`);
      setShowCreateDialog(false);
      setNewGuest({ fullName: "", email: "", phone: "", company: "", position: "", investmentPackage: "", notes: "" });
      utils.event.listGuests.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = trpc.event.deleteGuest.useMutation({
    onSuccess: () => {
      toast.success("Invitado eliminado");
      utils.event.listGuests.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const sendInvitationMutation = trpc.event.sendInvitation.useMutation({
    onSuccess: () => {
      toast.success("Invitación enviada por email");
      utils.event.listGuests.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const sendBulkMutation = trpc.event.sendBulkInvitations.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.sent} invitaciones enviadas, ${data.failed} fallidas`);
      utils.event.listGuests.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const guests = guestsQuery.data?.guests || [];
  const stats = guestsQuery.data?.stats;
  const isGlobalView = guestsQuery.data?.isGlobalView || false;

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

  const pendingInvitations = guests.filter((g: any) => !g.invitationSentAt);

  const exportExcelMutation = trpc.event.exportGuestsExcel.useMutation({
    onSuccess: (data) => {
      const byteCharacters = atob(data.base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Excel descargado exitosamente");
    },
    onError: (error) => toast.error(error.message),
  });

  const exportPDFMutation = trpc.event.exportGuestsPDF.useMutation({
    onSuccess: (data) => {
      const byteCharacters = atob(data.base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF descargado exitosamente");
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Vista indicator */}
      {isGlobalView && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <Eye className="h-4 w-4 text-amber-400" />
          <span className="text-sm text-amber-400 font-medium">
            Vista Global — Viendo invitados de todos los aliados
          </span>
        </div>
      )}
      {!isGlobalView && !guestsQuery.isLoading && (
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <Shield className="h-4 w-4 text-blue-400" />
          <span className="text-sm text-blue-400 font-medium">
            Mis Invitados — Solo ves los invitados que tú registraste
          </span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="border-border/40">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{stats?.total || 0}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card className="border-blue-500/20">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-blue-400">{stats?.invited || 0}</p>
            <p className="text-xs text-muted-foreground">Invitados</p>
          </CardContent>
        </Card>
        <Card className="border-yellow-500/20">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-yellow-400">{stats?.confirmed || 0}</p>
            <p className="text-xs text-muted-foreground">Confirmados</p>
          </CardContent>
        </Card>
        <Card className="border-green-500/20">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-green-400">{stats?.checkedIn || 0}</p>
            <p className="text-xs text-muted-foreground">Registrados</p>
          </CardContent>
        </Card>
        <Card className="border-red-500/20">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-red-400">{stats?.cancelled || 0}</p>
            <p className="text-xs text-muted-foreground">Cancelados</p>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, email o empresa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            <SelectItem value="INVITED">Invitados</SelectItem>
            <SelectItem value="CONFIRMED">Confirmados</SelectItem>
            <SelectItem value="CHECKED_IN">Registrados</SelectItem>
            <SelectItem value="CANCELLED">Cancelados</SelectItem>
          </SelectContent>
        </Select>

        {pendingInvitations.length > 0 && (
          <Button
            variant="outline"
            onClick={() => {
              const ids = pendingInvitations.map((g: any) => g.id);
              sendBulkMutation.mutate({ guestIds: ids });
            }}
            disabled={sendBulkMutation.isPending}
          >
            <Send className="mr-2 h-4 w-4" />
            Enviar Todas ({pendingInvitations.length})
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" disabled={exportExcelMutation.isPending || exportPDFMutation.isPending}>
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => exportExcelMutation.mutate()}>
              <FileSpreadsheet className="mr-2 h-4 w-4 text-green-500" />
              Descargar Excel
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportPDFMutation.mutate()}>
              <FileText className="mr-2 h-4 w-4 text-red-500" />
              Descargar PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="bg-green-600 hover:bg-green-700">
              <UserPlus className="mr-2 h-4 w-4" />
              Nuevo Invitado
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Crear Invitado</DialogTitle>
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

      {/* Lista de invitados */}
      <div className="space-y-3">
        {guestsQuery.isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : guests.length === 0 ? (
          <Card className="border-border/40">
            <CardContent className="p-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No hay invitados registrados</p>
              <Button
                onClick={() => setShowCreateDialog(true)}
                className="mt-4 bg-green-600 hover:bg-green-700"
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Crear Primer Invitado
              </Button>
            </CardContent>
          </Card>
        ) : (
          guests.map((guest: any) => (
            <Card key={guest.id} className="border-border/40 hover:border-green-500/20 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">{guest.fullName}</h3>
                      <Badge className={STATUS_COLORS[guest.status] || ""}>
                        {STATUS_LABELS[guest.status] || guest.status}
                      </Badge>
                      {guest.founderSlot && (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                          Cupo #{guest.founderSlot}
                        </Badge>
                      )}
                      {isGlobalView && guest.staffName && (
                        <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-400 border-purple-500/30">
                          Aliado: {guest.staffName}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {guest.email}
                      </span>
                      {guest.phone && (
                        <span className="flex items-center gap-1">
                          <span>📱</span> {guest.phone}
                        </span>
                      )}
                      {guest.company && (
                        <span className="flex items-center gap-1">
                          <span>🏢</span> {guest.company}
                          {guest.position && ` - ${guest.position}`}
                        </span>
                      )}
                    </div>
                    {guest.investmentPackage && (
                      <p className="text-xs text-green-400 mt-1">
                        {PACKAGE_LABELS[guest.investmentPackage] || guest.investmentPackage}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <QrCode className="h-3 w-3" /> {guest.qrCode}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1"
                        onClick={() => {
                          navigator.clipboard.writeText(guest.qrCode);
                          toast.success("Código QR copiado");
                        }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!guest.invitationSentAt ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => sendInvitationMutation.mutate({ guestId: guest.id })}
                        disabled={sendInvitationMutation.isPending}
                      >
                        <Send className="h-3 w-3 mr-1" />
                        Enviar
                      </Button>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        <CheckCircle2 className="h-3 w-3 mr-1 text-green-400" />
                        Enviada
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-300"
                      onClick={() => {
                        if (confirm(`¿Eliminar a ${guest.fullName}?`)) {
                          deleteMutation.mutate({ id: guest.id });
                        }
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
