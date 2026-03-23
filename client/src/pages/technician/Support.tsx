/**
 * Panel de Soporte - Técnico
 * Bandeja de tickets de usuarios para que el técnico responda como agente de soporte.
 * El técnico ES el soporte: ve tickets, responde chats, gestiona estados.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Inbox,
  MailOpen,
  Paperclip,
  X,
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
  general: "General",
  CHARGING: "Carga",
  charging: "Carga",
  BILLING: "Facturación",
  billing: "Facturación",
  TECHNICAL: "Técnico",
  technical: "Técnico",
  ACCOUNT: "Cuenta",
  account: "Cuenta",
  CHARGER_PROBLEM: "Problema cargador",
  charger_problem: "Problema cargador",
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  low: { label: "Baja", color: "bg-gray-500/20 text-gray-400" },
  medium: { label: "Media", color: "bg-yellow-500/20 text-yellow-400" },
  high: { label: "Alta", color: "bg-orange-500/20 text-orange-400" },
  urgent: { label: "Urgente", color: "bg-red-500/20 text-red-400" },
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function TechnicianSupport() {
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Get unread count for badge
  const unreadQuery = trpc.support.adminUnreadCount.useQuery(undefined, {
    refetchInterval: 15000,
  });

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Left panel - Ticket list */}
      <div className={`w-full md:w-[380px] lg:w-[420px] border-r border-border flex flex-col ${selectedTicketId ? "hidden md:flex" : ""}`}>
        {/* Header */}
        <div className="p-3 sm:p-4 border-b border-border space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold flex items-center gap-2">
              <Inbox className="w-5 h-5 text-green-500" />
              Bandeja de Soporte
            </h1>
            {(unreadQuery.data ?? 0) > 0 && (
              <Badge className="bg-red-500 text-white text-xs">
                {unreadQuery.data} sin leer
              </Badge>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por asunto o usuario..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>

          {/* Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 text-sm">
              <Filter className="w-3.5 h-3.5 mr-2" />
              <SelectValue placeholder="Filtrar por estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="WAITING_AGENT">Esperando agente</SelectItem>
              <SelectItem value="ASSIGNED">Asignados</SelectItem>
              <SelectItem value="OPEN">Abiertos</SelectItem>
              <SelectItem value="IN_PROGRESS">En progreso</SelectItem>
              <SelectItem value="RESOLVED">Resueltos</SelectItem>
            </SelectContent>
          </Select>

          {/* Quick tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full h-8">
              <TabsTrigger value="pending" className="flex-1 text-xs h-7">
                Pendientes
              </TabsTrigger>
              <TabsTrigger value="all" className="flex-1 text-xs h-7">
                Todos
              </TabsTrigger>
              <TabsTrigger value="resolved" className="flex-1 text-xs h-7">
                Resueltos
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Ticket list */}
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
            <div className="text-center px-4">
              <Headphones className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium mb-1">Panel de Soporte</p>
              <p className="text-sm opacity-70">
                Selecciona un ticket de la lista para ver la conversación y responder al usuario
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
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
    },
    { refetchInterval: 8000 }
  );

  if (ticketsQuery.isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  let tickets = ticketsQuery.data || [];

  // Filter by tab
  if (tab === "pending") {
    tickets = tickets.filter((t: any) =>
      ["WAITING_AGENT", "OPEN", "ASSIGNED", "IN_PROGRESS"].includes(t.status)
    );
  } else if (tab === "resolved") {
    tickets = tickets.filter((t: any) =>
      ["RESOLVED", "CLOSED"].includes(t.status)
    );
  }

  // Filter by search
  if (search.trim()) {
    const q = search.toLowerCase();
    tickets = tickets.filter((t: any) =>
      (t.subject || "").toLowerCase().includes(q) ||
      (t.description || "").toLowerCase().includes(q) ||
      (t.userName || "").toLowerCase().includes(q)
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground p-4">
        <div className="text-center">
          <MailOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm font-medium">No hay tickets</p>
          <p className="text-xs opacity-70 mt-1">
            {tab === "pending" ? "No hay tickets pendientes por atender" : "No se encontraron tickets"}
          </p>
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
          const priority = priorityConfig[ticket.priority] || priorityConfig.medium;
          const isUrgent = ticket.priority === "urgent" || ticket.priority === "high";

          return (
            <div
              key={ticket.id}
              className={`p-3 sm:p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                selectedId === ticket.id ? "bg-muted/80 border-l-2 border-l-green-500" : ""
              } ${isUrgent ? "border-l-2 border-l-red-500" : ""}`}
              onClick={() => onSelect(ticket.id)}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="font-medium text-sm line-clamp-1 flex-1">
                  #{ticket.id} - {ticket.subject || "Sin asunto"}
                </div>
                <Badge className={`${status.color} text-[10px] flex-shrink-0`}>
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {status.label}
                </Badge>
              </div>

              <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                {ticket.description || "Sin descripción"}
              </p>

              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {ticket.userName || "Usuario"}
                  </span>
                  {ticket.category && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                      {categoryLabels[ticket.category] || ticket.category}
                    </Badge>
                  )}
                  <Badge className={`${priority.color} text-[9px] px-1.5 py-0`}>
                    {priority.label}
                  </Badge>
                </div>
                <span>
                  {new Date(ticket.createdAt).toLocaleDateString("es-CO", {
                    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                  })}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

// ============================================================================
// TICKET DETAIL (Chat view + actions)
// ============================================================================

function TicketDetail({ ticketId, onBack }: { ticketId: number; onBack: () => void }) {
  const [replyMessage, setReplyMessage] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const messagesQuery = trpc.support.getMessages.useQuery(
    { ticketId },
    { refetchInterval: 5000 }
  );

  const replyMutation = trpc.support.reply.useMutation({
    onSuccess: () => {
      setReplyMessage("");
      messagesQuery.refetch();
      toast.success("Respuesta enviada al usuario");
    },
    onError: () => {
      toast.error("Error al enviar respuesta");
    },
  });

  // Upload attachment mutation
  const uploadMutation = trpc.support.uploadAttachment.useMutation({
    onSuccess: () => {
      setImagePreview(null);
      setImageFile(null);
      setIsUploading(false);
      messagesQuery.refetch();
      toast.success("Imagen enviada");
    },
    onError: () => {
      setIsUploading(false);
      toast.error("Error al subir la imagen");
    },
  });

  // Typing indicator
  const setTypingMutation = trpc.support.setTyping.useMutation();
  const typingQuery = trpc.support.getTypingStatus.useQuery(
    { ticketId },
    { refetchInterval: 2000 }
  );

  // Debounced typing indicator
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleTypingStart = useCallback(() => {
    setTypingMutation.mutate({ ticketId, isTyping: true });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setTypingMutation.mutate({ ticketId, isTyping: false });
    }, 3000);
  }, [ticketId]);

  // Handle image selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("La imagen no puede superar 10MB");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      toast.error("Solo se permiten im\u00e1genes JPEG, PNG, WebP o GIF");
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  // Send image
  const handleSendImage = async () => {
    if (!imageFile || isUploading) return;
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadMutation.mutate({
        ticketId,
        fileName: imageFile.name,
        fileBase64: base64,
        contentType: imageFile.type,
      });
    };
    reader.readAsDataURL(imageFile);
  };

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
  const priority = priorityConfig[ticket?.priority || "medium"] || priorityConfig.medium;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 sm:p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-2">
          <Button variant="ghost" size="icon" className="md:hidden h-8 w-8" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-sm line-clamp-1">
              #{ticket?.id} - {ticket?.subject || "Sin asunto"}
            </h2>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <Badge className={`${status.color} text-[10px]`}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {status.label}
              </Badge>
              <Badge className={`${priority.color} text-[10px]`}>
                {priority.label}
              </Badge>
              {ticket?.category && (
                <Badge variant="outline" className="text-[10px]">
                  {categoryLabels[ticket.category] || ticket.category}
                </Badge>
              )}
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <User className="w-3 h-3" />
                {(messagesQuery.data?.ticket as any)?.user?.name || `Usuario #${ticket?.userId}`}
              </span>
            </div>
          </div>
          <div className="flex gap-1.5 flex-shrink-0">
            {ticket?.status !== "ASSIGNED" && ticket?.status !== "RESOLVED" && ticket?.status !== "CLOSED" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => assignMutation.mutate({ ticketId, status: "ASSIGNED" })}
                disabled={assignMutation.isPending}
                className="text-xs h-8"
              >
                <UserCheck className="w-3 h-3 mr-1" />
                <span className="hidden sm:inline">Asignarme</span>
              </Button>
            )}
            {ticket?.status !== "RESOLVED" && ticket?.status !== "CLOSED" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => resolveMutation.mutate({ ticketId, status: "RESOLVED" })}
                disabled={resolveMutation.isPending}
                className="text-xs h-8 text-green-500 border-green-500/30"
              >
                <CheckCircle className="w-3 h-3 mr-1" />
                <span className="hidden sm:inline">Resolver</span>
              </Button>
            )}
          </div>
        </div>

        {/* Ticket description */}
        {ticket?.description && (
          <div className="bg-muted/50 p-2.5 rounded text-xs text-muted-foreground mt-1">
            <span className="font-medium text-foreground/80">Descripción: </span>
            {ticket.description}
          </div>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
        {messages.map((msg: any) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {messages.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>No hay mensajes en este ticket</p>
          </div>
        )}
      </div>

      {/* Typing indicator from user */}
      {typingQuery.data && typingQuery.data.length > 0 && (
        <div className="px-4 pb-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
            <span>{typingQuery.data[0].userName} est\u00e1 escribiendo...</span>
          </div>
        </div>
      )}

      {/* Image preview */}
      {imagePreview && (
        <div className="border-t border-border px-4 pt-3 bg-background">
          <div className="relative inline-block">
            <img src={imagePreview} alt="Preview" className="h-20 rounded-lg object-cover" />
            <button
              onClick={() => { setImagePreview(null); setImageFile(null); }}
              className="absolute -top-2 -right-2 bg-destructive text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <Button
            onClick={handleSendImage}
            disabled={isUploading}
            size="sm"
            className="ml-2 bg-green-600 hover:bg-green-700 text-white"
          >
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enviar imagen"}
          </Button>
        </div>
      )}

      {/* Reply input */}
      {ticket?.status !== "RESOLVED" && ticket?.status !== "CLOSED" ? (
        <div className="border-t border-border p-3 sm:p-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleImageSelect}
          />
          <div className="flex gap-2 items-end">
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 flex-shrink-0 text-muted-foreground hover:text-green-400"
              onClick={() => fileInputRef.current?.click()}
              title="Adjuntar imagen"
            >
              <Paperclip className="w-5 h-5" />
            </Button>
            <Textarea
              value={replyMessage}
              onChange={(e) => {
                setReplyMessage(e.target.value);
                handleTypingStart();
              }}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu respuesta al usuario..."
              className="min-h-[44px] max-h-[120px] resize-none text-sm"
              rows={1}
            />
            <Button
              onClick={handleSendReply}
              disabled={!replyMessage.trim() || replyMutation.isPending}
              className="h-11 w-11 p-0 flex-shrink-0 bg-green-600 hover:bg-green-700"
            >
              {replyMutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">
            Presiona Enter para enviar, Shift+Enter para nueva l\u00ednea
          </p>
        </div>
      ) : (
        <div className="border-t border-border p-4 text-center text-sm text-muted-foreground">
          <CheckCircle className="w-5 h-5 mx-auto mb-1 text-green-500" />
          Este ticket ha sido resuelto
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MESSAGE BUBBLE
// ============================================================================

function MessageBubble({ message }: { message: any }) {
  const isUser = message.senderRole === "user";
  const isSystem = message.senderRole === "system";
  const isAi = message.senderRole === "ai";
  const isAgent = message.senderRole === "agent";

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <div className="bg-muted/50 text-muted-foreground text-xs px-4 py-2 rounded-full max-w-[85%] text-center">
          {message.message}
        </div>
      </div>
    );
  }

  // Agent messages (from technician) go to the right, user/AI messages go to the left
  const isRight = isAgent;

  return (
    <div className={`flex items-start gap-2 ${isRight ? "flex-row-reverse" : ""}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
        isUser ? "bg-purple-500/20" : isAi ? "bg-emerald-500/20" : "bg-green-500/20"
      }`}>
        {isUser ? (
          <User className="w-3.5 h-3.5 text-purple-400" />
        ) : isAi ? (
          <Bot className="w-3.5 h-3.5 text-emerald-400" />
        ) : (
          <UserCheck className="w-3.5 h-3.5 text-green-400" />
        )}
      </div>
      <div className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 ${
        isRight
          ? "bg-green-600 text-white rounded-tr-sm"
          : isUser
            ? "bg-card border border-border rounded-tl-sm"
            : isAi
              ? "bg-emerald-500/10 border border-emerald-500/20 rounded-tl-sm"
              : "bg-card border border-border rounded-tl-sm"
      }`}>
        <div className={`text-[10px] font-medium mb-0.5 ${isRight ? "text-white/70" : "text-muted-foreground"}`}>
          {isUser ? (message.senderName || "Usuario") : isAi ? "Asistente IA" : (message.senderName || "Tú (Agente)")}
        </div>
        {message.attachmentUrl && (
          <div className="mb-2">
            <img
              src={message.attachmentUrl}
              alt="Adjunto"
              className="max-w-full max-h-48 rounded-lg cursor-pointer object-contain"
              onClick={() => window.open(message.attachmentUrl, "_blank")}
            />
          </div>
        )}
        {message.message && (
          <div className={`text-sm whitespace-pre-wrap leading-relaxed ${isRight ? "text-white" : ""}`}>
            {message.message}
          </div>
        )}
        <div className={`text-[10px] mt-1 ${isRight ? "text-white/60" : "text-muted-foreground"}`}>
          {new Date(message.createdAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
}
