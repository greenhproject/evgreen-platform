import { useState, useRef, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import AdminLayout from "@/layouts/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  MessageCircle,
  Search,
  Send,
  Bot,
  UserCheck,
  User,
  Clock,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Filter,
  ArrowLeft,
  Headphones,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

// ============================================================================
// STATUS HELPERS
// ============================================================================

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  AI_HANDLING: { label: "IA atendiendo", color: "bg-emerald-500/20 text-emerald-400", icon: Bot },
  OPEN: { label: "Abierto", color: "bg-orange-500/20 text-orange-400", icon: AlertTriangle },
  ASSIGNED: { label: "Asignado", color: "bg-blue-500/20 text-blue-400", icon: UserCheck },
  WAITING_AGENT: { label: "Esperando agente", color: "bg-yellow-500/20 text-yellow-400", icon: Clock },
  IN_PROGRESS: { label: "En progreso", color: "bg-blue-500/20 text-blue-400", icon: Zap },
  RESOLVED: { label: "Resuelto", color: "bg-green-500/20 text-green-400", icon: CheckCircle },
  CLOSED: { label: "Cerrado", color: "bg-gray-500/20 text-gray-400", icon: CheckCircle },
};

const categoryLabels: Record<string, string> = {
  GENERAL: "General",
  CHARGING: "Carga",
  BILLING: "Facturación",
  TECHNICAL: "Técnico",
  ACCOUNT: "Cuenta",
  CHARGER_PROBLEM: "Problema cargador",
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function AdminSupport() {
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  return (
    <AdminLayout>
      <div className="flex h-[calc(100vh-64px)]">
        {/* Left panel - Ticket list */}
        <div className={`w-full md:w-[400px] border-r border-border flex flex-col ${selectedTicketId ? "hidden md:flex" : ""}`}>
          <div className="p-4 border-b border-border space-y-3">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Headphones className="w-5 h-5" />
                Soporte
              </h1>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar tickets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Filters */}
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="flex-1">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="WAITING_AGENT">Esperando agente</SelectItem>
                  <SelectItem value="AI_HANDLING">IA atendiendo</SelectItem>
                  <SelectItem value="ASSIGNED">Asignados</SelectItem>
                  <SelectItem value="OPEN">Abiertos</SelectItem>
                  <SelectItem value="RESOLVED">Resueltos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full">
                <TabsTrigger value="all" className="flex-1 text-xs">Todos</TabsTrigger>
                <TabsTrigger value="chat" className="flex-1 text-xs">Chat</TabsTrigger>
                <TabsTrigger value="problems" className="flex-1 text-xs">Reportes</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <TicketList
            tab={activeTab}
            search={searchQuery}
            statusFilter={statusFilter}
            selectedId={selectedTicketId}
            onSelect={setSelectedTicketId}
          />
        </div>

        {/* Right panel - Ticket detail / Chat */}
        <div className={`flex-1 flex flex-col ${!selectedTicketId ? "hidden md:flex" : ""}`}>
          {selectedTicketId ? (
            <TicketDetail
              ticketId={selectedTicketId}
              onBack={() => setSelectedTicketId(null)}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Selecciona un ticket para ver los detalles</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

// ============================================================================
// TICKET LIST
// ============================================================================

function TicketList({ tab, search, statusFilter, selectedId, onSelect }: {
  tab: string;
  search: string;
  statusFilter: string;
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const ticketsQuery = trpc.support.listAll.useQuery(
    {
      status: statusFilter !== "all" ? statusFilter : undefined,
      category: tab === "problems" ? "charger_problem" : (tab === "chat" ? "general" : undefined),
    },
    { refetchInterval: 10000 }
  );

  if (ticketsQuery.isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const tickets = ticketsQuery.data || [];

  if (tickets.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground p-4">
        <div className="text-center">
          <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No hay tickets</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="divide-y divide-border">
        {tickets.map((ticket: any) => {
          const status = statusConfig[ticket.status] || statusConfig.OPEN;
          const StatusIcon = status.icon;
          return (
            <div
              key={ticket.id}
              className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                selectedId === ticket.id ? "bg-muted/80" : ""
              }`}
              onClick={() => onSelect(ticket.id)}
            >
              <div className="flex items-start justify-between mb-1">
                <div className="font-medium text-sm line-clamp-1 flex-1">
                  {ticket.subject || "Sin asunto"}
                </div>
                <Badge className={`${status.color} text-[10px] ml-2 flex-shrink-0`}>
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {status.label}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-1 mb-1">
                {ticket.description || "Sin descripción"}
              </p>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {ticket.userName || "Usuario"}
                </span>
                <span>
                  {new Date(ticket.createdAt).toLocaleDateString("es-CO", {
                    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                  })}
                </span>
              </div>
              {ticket.category && (
                <Badge variant="outline" className="text-[10px] mt-1">
                  {categoryLabels[ticket.category] || ticket.category}
                </Badge>
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

// ============================================================================
// TICKET DETAIL
// ============================================================================

function TicketDetail({ ticketId, onBack }: { ticketId: number; onBack: () => void }) {
  const [replyMessage, setReplyMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const messagesQuery = trpc.support.getMessages.useQuery(
    { ticketId },
    { refetchInterval: 5000 }
  );

  const replyMutation = trpc.support.reply.useMutation({
    onSuccess: () => {
      setReplyMessage("");
      messagesQuery.refetch();
      toast.success("Respuesta enviada");
    },
    onError: () => {
      toast.error("Error al enviar respuesta");
    },
  });

  const assignMutation = trpc.support.updateTicket.useMutation({
    onSuccess: () => {
      messagesQuery.refetch();
      toast.success("Ticket asignado a ti");
    },
  });

  const resolveMutation = trpc.support.updateTicket.useMutation({
    onSuccess: () => {
      messagesQuery.refetch();
      toast.success("Ticket marcado como resuelto");
    },
  });

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messagesQuery.data]);

  const handleSendReply = () => {
    const msg = replyMessage.trim();
    if (!msg) return;
    replyMutation.mutate({ ticketId, message: msg });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
  };

  if (messagesQuery.isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const ticket = messagesQuery.data?.ticket;
  const messages = messagesQuery.data?.messages || [];
  const status = statusConfig[ticket?.status || "OPEN"] || statusConfig.OPEN;
  const StatusIcon = status.icon;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3 mb-2">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-sm line-clamp-1">{ticket?.subject || "Sin asunto"}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={`${status.color} text-[10px]`}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {status.label}
              </Badge>
              {ticket?.category && (
                <Badge variant="outline" className="text-[10px]">
                  {categoryLabels[ticket.category] || ticket.category}
                </Badge>
              )}
              <span className="text-[10px] text-muted-foreground">
                #{ticket?.id}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            {ticket?.status !== "ASSIGNED" && ticket?.status !== "RESOLVED" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => assignMutation.mutate({ ticketId, status: "ASSIGNED" })}
                disabled={assignMutation.isPending}
              >
                <UserCheck className="w-3 h-3 mr-1" />
                Asignarme
              </Button>
            )}
            {ticket?.status !== "RESOLVED" && ticket?.status !== "CLOSED" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => resolveMutation.mutate({ ticketId, status: "RESOLVED" })}
                disabled={resolveMutation.isPending}
                className="text-green-500 border-green-500/30"
              >
                <CheckCircle className="w-3 h-3 mr-1" />
                Resolver
              </Button>
            )}
          </div>
        </div>
        {ticket?.description && (
          <p className="text-xs text-muted-foreground mt-2 bg-muted/50 p-2 rounded">
            {ticket.description}
          </p>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg: any) => (
          <AdminMessageBubble key={msg.id} message={msg} />
        ))}
        {messages.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No hay mensajes en este ticket
          </div>
        )}
      </div>

      {/* Reply input */}
      {ticket?.status !== "RESOLVED" && ticket?.status !== "CLOSED" && (
        <div className="border-t border-border p-4">
          <div className="flex gap-2 items-end">
            <Textarea
              value={replyMessage}
              onChange={(e) => setReplyMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu respuesta..."
              className="min-h-[44px] max-h-[120px] resize-none"
              rows={1}
            />
            <Button
              onClick={handleSendReply}
              disabled={!replyMessage.trim() || replyMutation.isPending}
              className="h-11 w-11 p-0 flex-shrink-0"
            >
              {replyMutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ADMIN MESSAGE BUBBLE
// ============================================================================

function AdminMessageBubble({ message }: { message: any }) {
  const isUser = message.senderRole === "user";
  const isSystem = message.senderRole === "system";
  const isAi = message.senderRole === "ai";
  const isAgent = message.senderRole === "agent";

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <div className="bg-muted/50 text-muted-foreground text-xs px-4 py-2 rounded-full max-w-[80%] text-center">
          {message.message}
        </div>
      </div>
    );
  }

  const isRight = isAgent;

  return (
    <div className={`flex items-start gap-2 ${isRight ? "flex-row-reverse" : ""}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
        isUser ? "bg-purple-500/20" : isAi ? "bg-emerald-500/20" : "bg-blue-500/20"
      }`}>
        {isUser ? (
          <User className="w-4 h-4 text-purple-400" />
        ) : isAi ? (
          <Bot className="w-4 h-4 text-emerald-400" />
        ) : (
          <UserCheck className="w-4 h-4 text-blue-400" />
        )}
      </div>
      <div className={`max-w-[70%] rounded-2xl px-4 py-3 ${
        isRight
          ? "bg-blue-600 text-white rounded-tr-sm"
          : isUser
            ? "bg-card border border-border rounded-tl-sm"
            : isAi
              ? "bg-emerald-500/10 border border-emerald-500/20 rounded-tl-sm"
              : "bg-card border border-border rounded-tl-sm"
      }`}>
        <div className={`text-xs font-medium mb-1 ${isRight ? "text-white/70" : "text-muted-foreground"}`}>
          {isUser ? (message.senderName || "Usuario") : isAi ? "Asistente IA" : (message.senderName || "Agente")}
        </div>
        <div className={`text-sm whitespace-pre-wrap ${isRight ? "text-white" : ""}`}>
          {message.message}
        </div>
        <div className={`text-[10px] mt-1 ${isRight ? "text-white/60" : "text-muted-foreground"}`}>
          {new Date(message.createdAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
}
