/**
 * Org Support - Portal de soporte completo para clientes SaaS
 * Incluye: lista de tickets, detalle con chat, timeline, FAQ y SLA por plan
 */
import { trpc } from "@/lib/trpc";
import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Ticket, Plus, Search, Clock, CheckCircle2, AlertCircle, XCircle,
  MessageSquare, Paperclip, Send, ChevronRight, HelpCircle,
  Shield, ArrowLeft, RefreshCw, Info, Calendar,
  User, Bot, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  OPEN:        { label: "Abierto",      color: "bg-blue-500/20 text-blue-400 border-blue-500/30",   icon: AlertCircle },
  IN_PROGRESS: { label: "En progreso",  color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: Clock },
  RESOLVED:    { label: "Resuelto",     color: "bg-green-500/20 text-green-400 border-green-500/30",  icon: CheckCircle2 },
  CLOSED:      { label: "Cerrado",      color: "bg-muted text-muted-foreground border-border",        icon: XCircle },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  LOW:      { label: "Baja",     color: "bg-muted text-muted-foreground" },
  MEDIUM:   { label: "Media",    color: "bg-yellow-500/20 text-yellow-400" },
  HIGH:     { label: "Alta",     color: "bg-orange-500/20 text-orange-400" },
  CRITICAL: { label: "Crítica",  color: "bg-red-500/20 text-red-400" },
};

const CATEGORY_LABELS: Record<string, string> = {
  CHARGING_ISSUE: "Problema de carga",
  CONNECTIVITY:   "Conectividad",
  PAYMENT:        "Pagos",
  APP_BUG:        "Bug en la app",
  MAINTENANCE:    "Mantenimiento",
  OTHER:          "Otro",
};

const SLA_BY_PLAN: Record<string, { label: string; color: string }> = {
  starter:      { label: "48 horas",  color: "text-muted-foreground" },
  professional: { label: "24 horas",  color: "text-yellow-400" },
  enterprise:   { label: "4 horas",   color: "text-green-400" },
};

const FAQ_ITEMS = [
  {
    q: "¿Cómo reinicio un cargador que no responde?",
    a: "Ve a Estaciones → selecciona la estación → pestaña OCPP → usa el botón 'Reiniciar'. Si el cargador no está conectado, desconecta y reconecta físicamente el cable de alimentación.",
  },
  {
    q: "¿Por qué el cargador aparece como 'Offline'?",
    a: "Verifica la conexión a internet del cargador. El servidor OCPP requiere conexión estable. Revisa que la identidad OCPP esté configurada correctamente en el cargador físico.",
  },
  {
    q: "¿Cómo cambio el precio por kWh?",
    a: "Ve a Estaciones → configura la estación → pestaña Tarifas. Puedes activar el Precio Automático IA o establecer un precio fijo.",
  },
  {
    q: "¿Cómo descargo el QR de una estación?",
    a: "Ve a Estaciones → configura la estación → pestaña QR. Puedes descargar o imprimir el código QR directamente desde ahí.",
  },
  {
    q: "¿Cómo agrego un nuevo usuario a mi organización?",
    a: "Ve a Usuarios → Invitar usuario. El usuario recibirá un correo con instrucciones para unirse a tu organización.",
  },
  {
    q: "¿Cómo exporto un reporte de ingresos?",
    a: "Ve a Reportes → selecciona el período y tipo de reporte → Descargar PDF o CSV.",
  },
];

// ─── Main Component ───────────────────────────────────────────────────────────
export default function OrgSupport() {
  const [view, setView] = useState<"list" | "detail" | "new">("list");
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data: org } = (trpc.organizations as any).getMyOrg.useQuery();
  const { data: tickets, isLoading, refetch } = (trpc.organizations as any).getMyTickets.useQuery(
    statusFilter !== "all" ? { status: statusFilter } : undefined
  );
  const { data: stations } = (trpc.organizations as any).getMyStations.useQuery();

  const plan = org?.plan || "starter";
  const sla = SLA_BY_PLAN[plan] || SLA_BY_PLAN.starter;

  const filtered = tickets?.filter((t: any) =>
    !search ||
    t.subject?.toLowerCase().includes(search.toLowerCase()) ||
    t.description?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const counts = {
    open:        tickets?.filter((t: any) => t.status === "OPEN").length || 0,
    in_progress: tickets?.filter((t: any) => t.status === "IN_PROGRESS").length || 0,
    resolved:    tickets?.filter((t: any) => t.status === "RESOLVED").length || 0,
  };

  if (view === "detail" && selectedTicketId) {
    return (
      <TicketDetail
        ticketId={selectedTicketId}
        onBack={() => { setView("list"); setSelectedTicketId(null); refetch(); }}
      />
    );
  }

  if (view === "new") {
    return (
      <NewTicketForm
        stations={stations || []}
        onBack={() => setView("list")}
        onCreated={() => { setView("list"); refetch(); }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Ticket className="h-7 w-7 text-green-400" />
            Soporte / Tickets
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Gestiona tus solicitudes de soporte con el equipo EVGreen
          </p>
        </div>
        <Button className="bg-green-600 hover:bg-green-700 gap-2 self-start" onClick={() => setView("new")}>
          <Plus className="h-4 w-4" /> Nuevo Ticket
        </Button>
      </div>

      {/* SLA Banner */}
      <div className={`flex items-center gap-3 p-3 rounded-xl border ${plan === "enterprise" ? "bg-green-500/10 border-green-500/20" : plan === "professional" ? "bg-yellow-500/10 border-yellow-500/20" : "bg-muted/30 border-border/30"}`}>
        <Shield className={`h-5 w-5 shrink-0 ${sla.color}`} />
        <div className="flex-1">
          <p className="text-sm font-semibold">SLA de respuesta: <span className={sla.color}>{sla.label}</span></p>
          <p className="text-xs text-muted-foreground">Plan {plan.charAt(0).toUpperCase() + plan.slice(1)} · Soporte: soporte@greenhproject.com</p>
        </div>
        <Badge className={`text-xs ${plan === "enterprise" ? "bg-green-500/20 text-green-400" : plan === "professional" ? "bg-yellow-500/20 text-yellow-400" : "bg-muted text-muted-foreground"}`}>
          {plan.toUpperCase()}
        </Badge>
      </div>

      <Tabs defaultValue="tickets">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="tickets" className="gap-2"><Ticket className="h-4 w-4" /> Mis Tickets</TabsTrigger>
          <TabsTrigger value="faq" className="gap-2"><HelpCircle className="h-4 w-4" /> Base de Conocimiento</TabsTrigger>
        </TabsList>

        {/* ── Tickets Tab ── */}
        <TabsContent value="tickets" className="space-y-4 pt-2">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { key: "all",        label: "Todos",       count: tickets?.length || 0, color: "text-foreground" },
              { key: "OPEN",       label: "Abiertos",    count: counts.open,          color: "text-blue-400" },
              { key: "IN_PROGRESS",label: "En progreso", count: counts.in_progress,   color: "text-yellow-400" },
              { key: "RESOLVED",   label: "Resueltos",   count: counts.resolved,      color: "text-green-400" },
            ].map(({ key, label, count, color }) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`p-2.5 rounded-xl border text-center transition-all ${statusFilter === key ? "bg-green-500/10 border-green-500/30" : "bg-muted/20 border-border/30 hover:bg-muted/40"}`}
              >
                <p className={`text-lg font-bold ${color}`}>{count}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar tickets..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>

          {/* Ticket list */}
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Cargando tickets...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground space-y-3">
              <Ticket className="h-12 w-12 mx-auto opacity-30" />
              <p>No hay tickets de soporte</p>
              <Button variant="outline" className="gap-2" onClick={() => setView("new")}>
                <Plus className="h-4 w-4" /> Crear primer ticket
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((ticket: any) => (
                <TicketRow
                  key={ticket.id}
                  ticket={ticket}
                  onClick={() => { setSelectedTicketId(ticket.id); setView("detail"); }}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── FAQ Tab ── */}
        <TabsContent value="faq" className="pt-2">
          <FAQSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Ticket Row ───────────────────────────────────────────────────────────────
function TicketRow({ ticket, onClick }: { ticket: any; onClick: () => void }) {
  const status = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.OPEN;
  const priority = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.MEDIUM;
  const StatusIcon = status.icon;

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 rounded-xl border border-border/50 bg-card hover:bg-muted/30 transition-all group"
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 p-1.5 rounded-lg ${status.color.split(" ")[0]}`}>
          <StatusIcon className={`h-4 w-4 ${status.color.split(" ")[1]}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm truncate">{ticket.subject}</span>
            <Badge className={`text-xs shrink-0 border ${status.color}`}>{status.label}</Badge>
            <Badge className={`text-xs shrink-0 ${priority.color}`}>{priority.label}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{ticket.description}</p>
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <span>#{ticket.id}</span>
            {ticket.category && <span>{CATEGORY_LABELS[ticket.category] || ticket.category}</span>}
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(ticket.createdAt).toLocaleDateString("es-CO")}
            </span>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1 group-hover:text-foreground transition-colors" />
      </div>
    </button>
  );
}

// ─── Ticket Detail ────────────────────────────────────────────────────────────
function TicketDetail({ ticketId, onBack }: { ticketId: number; onBack: () => void }) {
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: ticket, isLoading, refetch } = (trpc.organizations as any).getMyTicketDetail.useQuery(
    { ticketId },
    { refetchInterval: 15000 }
  );

  const addMessage = (trpc.organizations as any).addTicketMessage.useMutation({
    onSuccess: () => { setMessage(""); refetch(); },
    onError: (err: any) => toast.error(err.message || "Error al enviar mensaje"),
  });

  const closeTicket = (trpc.organizations as any).closeMyTicket.useMutation({
    onSuccess: () => { toast.success("Ticket cerrado"); onBack(); },
    onError: (err: any) => toast.error(err.message || "Error al cerrar ticket"),
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticket?.messages]);

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Cargando ticket...</div>;
  if (!ticket) return <div className="text-center py-12 text-muted-foreground">Ticket no encontrado</div>;

  const status = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.OPEN;
  const priority = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.MEDIUM;
  const StatusIcon = status.icon;
  const isClosed = ticket.status === "CLOSED";

  const handleSend = () => {
    if (!message.trim()) return;
    addMessage.mutate({ ticketId, message: message.trim() });
  };

  return (
    <div className="space-y-4">
      {/* Back button */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Button>
        <button onClick={() => refetch()} className="ml-auto text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Ticket header */}
      <Card className="border-border/50">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-xl ${status.color.split(" ")[0]}`}>
              <StatusIcon className={`h-5 w-5 ${status.color.split(" ")[1]}`} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-base">{ticket.subject}</h2>
              <div className="flex flex-wrap gap-2 mt-1.5">
                <Badge className={`text-xs border ${status.color}`}>{status.label}</Badge>
                <Badge className={`text-xs ${priority.color}`}>{priority.label}</Badge>
                {ticket.category && <Badge variant="outline" className="text-xs">{CATEGORY_LABELS[ticket.category] || ticket.category}</Badge>}
              </div>
            </div>
          </div>

          <p className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">{ticket.description}</p>

          {/* Timeline */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Historial</p>
            <div className="space-y-1.5">
              <TimelineItem icon={<Plus className="h-3 w-3" />} text="Ticket creado" time={ticket.createdAt} color="blue" />
              {ticket.assignedToId && <TimelineItem icon={<User className="h-3 w-3" />} text="Asignado a un agente" time={ticket.updatedAt} color="yellow" />}
              {ticket.status === "IN_PROGRESS" && <TimelineItem icon={<Clock className="h-3 w-3" />} text="En progreso" time={ticket.updatedAt} color="yellow" />}
              {ticket.status === "RESOLVED" && <TimelineItem icon={<CheckCircle2 className="h-3 w-3" />} text="Resuelto por el equipo EVGreen" time={ticket.resolvedAt || ticket.updatedAt} color="green" />}
              {ticket.status === "CLOSED" && <TimelineItem icon={<XCircle className="h-3 w-3" />} text="Ticket cerrado" time={ticket.resolvedAt || ticket.updatedAt} color="gray" />}
            </div>
          </div>

          {ticket.resolution && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
              <p className="text-xs font-semibold text-green-400 mb-1">✓ Resolución del equipo EVGreen</p>
              <p className="text-sm text-muted-foreground">{ticket.resolution}</p>
            </div>
          )}

          {!isClosed && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs text-red-400 border-red-500/30 hover:bg-red-500/10"
              onClick={() => closeTicket.mutate({ ticketId })}
              disabled={closeTicket.isPending}
            >
              <XCircle className="h-3.5 w-3.5 mr-1.5" />
              Marcar como resuelto y cerrar
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Chat */}
      <Card className="border-border/50">
        <CardContent className="p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <MessageSquare className="h-3.5 w-3.5" />
            Conversación ({ticket.messages?.length || 0} mensajes)
          </p>

          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {!ticket.messages || ticket.messages.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>No hay mensajes aún. El equipo EVGreen responderá pronto.</p>
              </div>
            ) : (
              ticket.messages.map((msg: any) => (
                <ChatMessage key={msg.id} message={msg} />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {!isClosed ? (
            <div className="flex gap-2 pt-2 border-t border-border/30">
              <Textarea
                placeholder="Escribe tu mensaje... (Enter para enviar)"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="min-h-[60px] resize-none text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
                }}
              />
              <Button
                className="bg-green-600 hover:bg-green-700 shrink-0 self-end"
                onClick={handleSend}
                disabled={!message.trim() || addMessage.isPending}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="text-center py-3 text-sm text-muted-foreground bg-muted/30 rounded-lg">
              Este ticket está cerrado. Si necesitas más ayuda, crea un nuevo ticket.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Chat Message ─────────────────────────────────────────────────────────────
function ChatMessage({ message }: { message: any }) {
  const isUser = message.senderRole === "user";
  const isSystem = message.senderRole === "system";

  if (isSystem) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center py-1">
        <div className="h-px flex-1 bg-border/30" />
        <span className="px-2">{message.message}</span>
        <div className="h-px flex-1 bg-border/30" />
      </div>
    );
  }

  return (
    <div className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${isUser ? "bg-green-500/20 text-green-400" : "bg-blue-500/20 text-blue-400"}`}>
        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </div>
      <div className={`max-w-[75%] space-y-1 ${isUser ? "items-end" : "items-start"} flex flex-col`}>
        <div className={`px-3 py-2 rounded-xl text-sm ${isUser ? "bg-green-600 text-white rounded-tr-sm" : "bg-muted/50 text-foreground rounded-tl-sm"}`}>
          {message.message}
          {message.attachmentUrl && (
            <a href={message.attachmentUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 mt-1 text-xs underline opacity-80">
              <Paperclip className="h-3 w-3" /> Ver adjunto
            </a>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>{isUser ? "Tú" : (message.senderName || "EVGreen Soporte")}</span>
          <span>·</span>
          <span>{new Date(message.createdAt).toLocaleString("es-CO", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}</span>
          {!isUser && message.readAt && <span className="text-green-400">· Leído</span>}
        </div>
      </div>
    </div>
  );
}

// ─── New Ticket Form ──────────────────────────────────────────────────────────
function NewTicketForm({ stations, onBack, onCreated }: { stations: any[]; onBack: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    subject: "",
    description: "",
    category: "OTHER",
    priority: "MEDIUM",
    stationId: undefined as number | undefined,
  });

  const createTicket = (trpc.organizations as any).createMyTicket.useMutation({
    onSuccess: () => { toast.success("Ticket creado exitosamente. El equipo EVGreen responderá pronto."); onCreated(); },
    onError: (err: any) => toast.error(err.message || "Error al crear ticket"),
  });

  const handleSubmit = () => {
    if (!form.subject.trim() || form.subject.length < 5) { toast.error("El asunto debe tener al menos 5 caracteres"); return; }
    if (!form.description.trim() || form.description.length < 10) { toast.error("La descripción debe tener al menos 10 caracteres"); return; }
    createTicket.mutate({
      subject: form.subject,
      description: form.description,
      category: form.category as any,
      priority: form.priority as any,
      stationId: form.stationId,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Button>
      </div>

      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Plus className="h-6 w-6 text-green-400" /> Nuevo Ticket de Soporte
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Describe tu problema y el equipo EVGreen te responderá pronto.</p>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-4 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Asunto *</Label>
            <Input
              placeholder="Ej: Cargador EVG001 no responde"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Categoría</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Prioridad</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {stations.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Estación relacionada (opcional)</Label>
              <Select
                value={form.stationId?.toString() || "none"}
                onValueChange={(v) => setForm({ ...form, stationId: v !== "none" ? parseInt(v) : undefined })}
              >
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecciona una estación" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin estación específica</SelectItem>
                  {stations.map((s: any) => (
                    <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Descripción detallada *</Label>
            <Textarea
              placeholder="Describe el problema con el mayor detalle posible: qué pasó, cuándo ocurrió, qué pasos seguiste..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="min-h-[120px] resize-none text-sm"
            />
            <p className="text-xs text-muted-foreground">{form.description.length}/2000 caracteres</p>
          </div>

          {form.priority === "CRITICAL" && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">Los tickets críticos son para emergencias que afectan todas las operaciones. Para urgencias, también puedes escribir directamente a soporte@greenhproject.com.</p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onBack} disabled={createTicket.isPending} className="flex-1">Cancelar</Button>
            <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={handleSubmit} disabled={createTicket.isPending}>
              {createTicket.isPending ? "Creando..." : "Crear Ticket"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── FAQ Section ──────────────────────────────────────────────────────────────
function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
        <Info className="h-4 w-4 text-blue-400 shrink-0" />
        <p className="text-sm text-blue-300">Encuentra respuestas rápidas a las preguntas más frecuentes antes de crear un ticket.</p>
      </div>

      <div className="space-y-2">
        {FAQ_ITEMS.map((item, idx) => (
          <div key={idx} className="border border-border/50 rounded-xl overflow-hidden">
            <button
              className="w-full text-left p-4 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
              onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
            >
              <div className="flex items-center gap-3">
                <HelpCircle className="h-4 w-4 text-green-400 shrink-0" />
                <span className="text-sm font-medium">{item.q}</span>
              </div>
              <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${openIndex === idx ? "rotate-180" : ""}`} />
            </button>
            {openIndex === idx && (
              <div className="px-4 pb-4">
                <div className="ml-7 text-sm text-muted-foreground leading-relaxed border-l-2 border-green-500/30 pl-4">
                  {item.a}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="text-center p-4 bg-muted/20 rounded-xl border border-border/30">
        <p className="text-sm text-muted-foreground">¿No encontraste lo que buscabas?</p>
        <p className="text-xs text-muted-foreground mt-1">Escríbenos a <span className="text-green-400">soporte@greenhproject.com</span> o crea un ticket de soporte.</p>
      </div>
    </div>
  );
}

// ─── Timeline Item ────────────────────────────────────────────────────────────
function TimelineItem({ icon, text, time, color }: { icon: any; text: string; time: any; color: string }) {
  const colors: Record<string, string> = {
    blue:   "bg-blue-500/20 text-blue-400",
    yellow: "bg-yellow-500/20 text-yellow-400",
    green:  "bg-green-500/20 text-green-400",
    gray:   "bg-muted text-muted-foreground",
  };
  return (
    <div className="flex items-center gap-2.5 text-xs">
      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${colors[color]}`}>{icon}</div>
      <span className="text-muted-foreground flex-1">{text}</span>
      {time && <span className="text-muted-foreground/60">{new Date(time).toLocaleDateString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>}
    </div>
  );
}
