/**
 * Org Support - Portal de tickets de soporte para organización SaaS
 * Permite crear y ver tickets de soporte para las estaciones de la organización
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Ticket,
  Plus,
  Clock,
  CheckCircle,
  AlertCircle,
  Search,
  Filter,
} from "lucide-react";
import { toast } from "sonner";

export default function OrgSupport() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [search, setSearch] = useState("");

  const { data: tickets, isLoading, refetch } = (trpc.organizations as any).getMyTickets.useQuery(
    filterStatus ? { status: filterStatus } : undefined
  );
  const { data: stations } = (trpc.organizations as any).getMyStations.useQuery();

  const createTicket = (trpc.organizations as any).createMyTicket.useMutation({
    onSuccess: () => {
      toast.success("Ticket creado exitosamente");
      setShowCreateDialog(false);
      refetch();
    },
    onError: (err: any) => toast.error(err.message || "Error al crear ticket"),
  });

  const filtered = tickets?.filter((t: any) =>
    !search ||
    t.subject?.toLowerCase().includes(search.toLowerCase()) ||
    t.description?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const openCount = tickets?.filter((t: any) => t.status === "OPEN").length || 0;
  const inProgressCount = tickets?.filter((t: any) => t.status === "IN_PROGRESS").length || 0;
  const resolvedCount = tickets?.filter((t: any) => t.status === "RESOLVED" || t.status === "CLOSED").length || 0;

  const ticketStatusConfig: Record<string, { label: string; className: string; icon: any }> = {
    OPEN: { label: "Abierto", className: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: AlertCircle },
    IN_PROGRESS: { label: "En Progreso", className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: Clock },
    RESOLVED: { label: "Resuelto", className: "bg-green-500/20 text-green-400 border-green-500/30", icon: CheckCircle },
    CLOSED: { label: "Cerrado", className: "bg-gray-500/20 text-gray-400 border-gray-500/30", icon: CheckCircle },
  };

  const priorityConfig: Record<string, { label: string; className: string }> = {
    LOW: { label: "Baja", className: "text-gray-400" },
    MEDIUM: { label: "Media", className: "text-blue-400" },
    HIGH: { label: "Alta", className: "text-orange-400" },
    CRITICAL: { label: "Crítica", className: "text-red-400" },
  };

  const categoryLabels: Record<string, string> = {
    CHARGING_ISSUE: "Problema de Carga",
    CONNECTIVITY: "Conectividad",
    PAYMENT: "Pagos",
    APP_BUG: "Bug de App",
    MAINTENANCE: "Mantenimiento",
    OTHER: "Otro",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Ticket className="h-7 w-7 text-orange-400" />
            Soporte / Tickets
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Crea y gestiona tickets de soporte para tus estaciones
          </p>
        </div>
        <Button
          className="bg-green-600 hover:bg-green-700 shrink-0"
          onClick={() => setShowCreateDialog(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Ticket
        </Button>
      </div>

      {/* Stats */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <AlertCircle className="h-4 w-4 text-blue-400" />
          <span className="text-sm font-medium text-blue-400">{openCount} abiertos</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <Clock className="h-4 w-4 text-yellow-400" />
          <span className="text-sm font-medium text-yellow-400">{inProgressCount} en progreso</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
          <CheckCircle className="h-4 w-4 text-green-400" />
          <span className="text-sm font-medium text-green-400">{resolvedCount} resueltos</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar tickets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px]">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="OPEN">Abiertos</SelectItem>
            <SelectItem value="IN_PROGRESS">En Progreso</SelectItem>
            <SelectItem value="RESOLVED">Resueltos</SelectItem>
            <SelectItem value="CLOSED">Cerrados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tickets List */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Cargando tickets...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Ticket className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>{search ? "No se encontraron tickets con ese criterio" : "No hay tickets de soporte"}</p>
          {!search && (
            <Button
              className="mt-4 bg-green-600 hover:bg-green-700"
              onClick={() => setShowCreateDialog(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Crear primer ticket
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((t: any) => {
            const statusCfg = ticketStatusConfig[t.status] || ticketStatusConfig.OPEN;
            const priorityCfg = priorityConfig[t.priority] || priorityConfig.MEDIUM;
            const StatusIcon = statusCfg.icon;

            return (
              <Card key={t.id} className="border-border/50 hover:border-border transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg shrink-0 ${
                      t.status === "OPEN" ? "bg-blue-500/10" :
                      t.status === "IN_PROGRESS" ? "bg-yellow-500/10" :
                      "bg-green-500/10"
                    }`}>
                      <StatusIcon className={`h-4 w-4 ${
                        t.status === "OPEN" ? "text-blue-400" :
                        t.status === "IN_PROGRESS" ? "text-yellow-400" :
                        "text-green-400"
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm">{t.subject}</p>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className={`text-xs ${statusCfg.className}`}>
                            {statusCfg.label}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                        <span className={priorityCfg.className}>
                          Prioridad: {priorityCfg.label}
                        </span>
                        {t.category && (
                          <span>{categoryLabels[t.category] || t.category}</span>
                        )}
                        <span>{t.createdAt ? new Date(t.createdAt).toLocaleDateString("es-CO") : "-"}</span>
                      </div>
                      {t.resolution && (
                        <div className="mt-2 p-2 rounded bg-green-500/5 border border-green-500/20">
                          <p className="text-xs text-green-400 font-medium">Resolución:</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{t.resolution}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Ticket Dialog */}
      <CreateTicketDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        stations={stations || []}
        onSubmit={(data) => createTicket.mutate(data)}
        isLoading={createTicket.isPending}
      />
    </div>
  );
}

// ==========================================
// Create Ticket Dialog
// ==========================================
function CreateTicketDialog({ open, onClose, stations, onSubmit, isLoading }: {
  open: boolean;
  onClose: () => void;
  stations: any[];
  onSubmit: (data: any) => void;
  isLoading: boolean;
}) {
  const [form, setForm] = useState({
    subject: "",
    description: "",
    category: "CHARGING_ISSUE" as const,
    priority: "MEDIUM" as const,
    stationId: "" as string,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...form,
      stationId: form.stationId ? parseInt(form.stationId) : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5 text-orange-400" />
            Nuevo Ticket de Soporte
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Asunto *</Label>
            <Input
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="Describe brevemente el problema"
              required
              minLength={5}
            />
          </div>

          <div>
            <Label>Descripción *</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Describe el problema en detalle: qué ocurrió, cuándo, qué pasos seguiste..."
              required
              minLength={10}
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Categoría</Label>
              <Select value={form.category} onValueChange={(v: any) => setForm({ ...form, category: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CHARGING_ISSUE">Problema de Carga</SelectItem>
                  <SelectItem value="CONNECTIVITY">Conectividad</SelectItem>
                  <SelectItem value="PAYMENT">Pagos</SelectItem>
                  <SelectItem value="APP_BUG">Bug de App</SelectItem>
                  <SelectItem value="MAINTENANCE">Mantenimiento</SelectItem>
                  <SelectItem value="OTHER">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prioridad</Label>
              <Select value={form.priority} onValueChange={(v: any) => setForm({ ...form, priority: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Baja</SelectItem>
                  <SelectItem value="MEDIUM">Media</SelectItem>
                  <SelectItem value="HIGH">Alta</SelectItem>
                  <SelectItem value="CRITICAL">Crítica</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {stations.length > 0 && (
            <div>
              <Label>Estación relacionada (opcional)</Label>
              <Select value={form.stationId} onValueChange={(v) => setForm({ ...form, stationId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar estación..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin estación específica</SelectItem>
                  {stations.map((s: any) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name} — {s.city || s.address || "Sin ubicación"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button type="submit" className="w-full bg-green-600 hover:bg-green-700" disabled={isLoading}>
            {isLoading ? "Creando..." : "Crear Ticket"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
