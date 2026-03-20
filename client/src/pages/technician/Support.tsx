import { useState, useRef, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MessageCircle,
  Send,
  Bot,
  UserCheck,
  Loader2,
  Headphones,
  ArrowLeft,
  Search,
  Clock,
  CheckCircle,
  AlertTriangle,
  Zap,
  MapPin,
  Phone,
  Mail,
  History,
  ChevronRight,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

// ============================================================================
// TYPES
// ============================================================================

interface ChatMessage {
  id: number;
  senderRole: "user" | "ai" | "agent" | "system";
  message: string;
  createdAt: string;
  senderName?: string;
}

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

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function TechnicianSupport() {
  const [view, setView] = useState<"main" | "chat" | "history">("main");
  const [activeTicketId, setActiveTicketId] = useState<number | null>(null);

  return (
    <div className="space-y-6">
      {view === "main" && (
        <MainView
          onOpenChat={(ticketId) => {
            setActiveTicketId(ticketId);
            setView("chat");
          }}
          onOpenHistory={() => setView("history")}
        />
      )}
      {view === "chat" && (
        <ChatView
          ticketId={activeTicketId}
          onBack={() => {
            setView("main");
            setActiveTicketId(null);
          }}
        />
      )}
      {view === "history" && (
        <HistoryView
          onBack={() => setView("main")}
          onOpenTicket={(id) => {
            setActiveTicketId(id);
            setView("chat");
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// MAIN VIEW
// ============================================================================

function MainView({
  onOpenChat,
  onOpenHistory,
}: {
  onOpenChat: (ticketId: number | null) => void;
  onOpenHistory: () => void;
}) {
  const unreadQuery = trpc.support.unreadCount.useQuery(undefined, {
    refetchInterval: 30000,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <Headphones className="h-6 w-6 text-amber-500" />
          Soporte Técnico
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Contacta al equipo de soporte para reportar problemas o solicitar ayuda
        </p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* New chat */}
        <Card
          className="p-4 cursor-pointer hover:bg-muted/50 transition-colors border-amber-500/30 bg-amber-500/5"
          onClick={() => onOpenChat(null)}
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-6 h-6 text-amber-400" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-sm">Nuevo chat</div>
              <div className="text-xs text-muted-foreground">Asistencia IA inmediata</div>
            </div>
          </div>
        </Card>

        {/* Call support */}
        <Card
          className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => window.open("tel:+573001234567")}
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
              <Phone className="w-6 h-6 text-blue-400" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-sm">Llamar soporte</div>
              <div className="text-xs text-muted-foreground">Línea directa 24/7</div>
            </div>
          </div>
        </Card>

        {/* Email */}
        <Card
          className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => window.open("mailto:soporte@greenhproject.com")}
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <Mail className="w-6 h-6 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-sm">Email</div>
              <div className="text-xs text-muted-foreground truncate">soporte@greenhproject.com</div>
            </div>
          </div>
        </Card>
      </div>

      {/* History button */}
      <Card
        className="p-4 cursor-pointer hover:bg-muted/50 transition-colors flex items-center justify-between"
        onClick={onOpenHistory}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <History className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <div className="font-semibold text-sm">Mis conversaciones</div>
            <div className="text-xs text-muted-foreground">Ver historial de soporte</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(unreadQuery.data ?? 0) > 0 && (
            <Badge variant="destructive" className="text-xs">
              {unreadQuery.data}
            </Badge>
          )}
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </div>
      </Card>

      {/* Assigned tickets from support system */}
      <AssignedTicketsSection onOpenTicket={(id) => onOpenChat(id)} />
    </div>
  );
}

// ============================================================================
// ASSIGNED TICKETS SECTION (tickets assigned to this technician)
// ============================================================================

function AssignedTicketsSection({ onOpenTicket }: { onOpenTicket: (id: number) => void }) {
  const ticketsQuery = trpc.support.listAll.useQuery({ status: undefined, category: undefined });
  const [searchQuery, setSearchQuery] = useState("");

  // Filter tickets that are open or assigned
  const activeTickets = useMemo(() => {
    const tickets = ticketsQuery.data || [];
    const active = tickets.filter(
      (t: any) => !["RESOLVED", "CLOSED"].includes(t.status)
    );
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return active.filter(
        (t: any) =>
          t.subject?.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q) ||
          String(t.id).includes(q)
      );
    }
    return active;
  }, [ticketsQuery.data, searchQuery]);

  if (ticketsQuery.isLoading) {
    return (
      <Card className="p-8 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg">Tickets de soporte activos</h2>
        <Badge variant="outline" className="text-xs">
          {activeTickets.length} activos
        </Badge>
      </div>

      {activeTickets.length > 5 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar tickets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      )}

      {activeTickets.length === 0 ? (
        <Card className="p-8 text-center">
          <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No hay tickets de soporte activos</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {activeTickets.slice(0, 10).map((ticket: any) => {
            const status = statusConfig[ticket.status] || statusConfig.OPEN;
            const StatusIcon = status.icon;
            return (
              <Card
                key={ticket.id}
                className="p-3 sm:p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => onOpenTicket(ticket.id)}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="font-medium text-sm line-clamp-1 flex-1">
                    #{ticket.id} - {ticket.subject}
                  </div>
                  <Badge className={`${status.color} text-[10px] flex-shrink-0`}>
                    <StatusIcon className="w-3 h-3 mr-1" />
                    {status.label}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                  {ticket.description}
                </p>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(ticket.createdAt).toLocaleDateString("es-CO", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {ticket.category && (
                    <span className="flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      {ticket.category}
                    </span>
                  )}
                </div>
              </Card>
            );
          })}
          {activeTickets.length > 10 && (
            <p className="text-xs text-muted-foreground text-center py-2">
              Mostrando 10 de {activeTickets.length} tickets
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// CHAT VIEW (AI + Human)
// ============================================================================

function ChatView({
  ticketId,
  onBack,
}: {
  ticketId: number | null;
  onBack: () => void;
}) {
  const [currentTicketId, setCurrentTicketId] = useState<number | null>(ticketId);
  const [inputMessage, setInputMessage] = useState("");
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [ticketStatus, setTicketStatus] = useState<string>("AI_HANDLING");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load existing messages if ticket exists
  const messagesQuery = trpc.support.getMessages.useQuery(
    { ticketId: currentTicketId! },
    {
      enabled: !!currentTicketId,
      refetchInterval: ticketStatus !== "AI_HANDLING" ? 5000 : false,
    }
  );

  // Send message mutation
  const sendMutation = trpc.support.sendMessage.useMutation({
    onSuccess: (result) => {
      setCurrentTicketId(result.ticketId);
      if (result.status) setTicketStatus(result.status);

      if (result.aiResponse) {
        setLocalMessages((prev) => [
          ...prev,
          {
            id: Date.now(),
            senderRole: result.escalated ? "system" : "ai",
            message: result.aiResponse!,
            createdAt: new Date().toISOString(),
          },
        ]);
        if (result.escalated && result.status === "ASSIGNED") {
          setLocalMessages((prev) => [
            ...prev,
            {
              id: Date.now() + 1,
              senderRole: "system",
              message:
                "Tu conversación ha sido transferida a un agente de soporte. Te responderá en breve.",
              createdAt: new Date().toISOString(),
            },
          ]);
        }
      }
      setIsAiTyping(false);
    },
    onError: () => {
      setIsAiTyping(false);
      toast.error("Error al enviar mensaje. Intenta de nuevo.");
    },
  });

  // Request human agent
  const requestHumanMutation = trpc.support.requestHumanAgent.useMutation({
    onSuccess: (result) => {
      setTicketStatus(result.hasAgent ? "ASSIGNED" : "WAITING_AGENT");
      messagesQuery.refetch();
      toast.success(
        result.hasAgent
          ? "Te hemos conectado con un agente de soporte"
          : "Tu solicitud ha sido registrada. Te responderemos pronto."
      );
    },
  });

  // Reply mutation (for agents)
  const replyMutation = trpc.support.reply.useMutation({
    onSuccess: () => {
      messagesQuery.refetch();
    },
    onError: () => {
      toast.error("Error al enviar respuesta");
    },
  });

  // Merge server messages with local ones
  const allMessages = useMemo(() => {
    if (messagesQuery.data?.messages) {
      return messagesQuery.data.messages as unknown as ChatMessage[];
    }
    return localMessages;
  }, [messagesQuery.data, localMessages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [allMessages, isAiTyping]);

  // Update ticket status from server
  useEffect(() => {
    if (messagesQuery.data?.ticket?.status) {
      setTicketStatus(messagesQuery.data.ticket.status);
    }
  }, [messagesQuery.data]);

  const handleSend = () => {
    const msg = inputMessage.trim();
    if (!msg || sendMutation.isPending || replyMutation.isPending) return;

    // If the ticket is assigned and we're a technician replying as agent
    const isAgentReply =
      currentTicketId &&
      ticketStatus !== "AI_HANDLING" &&
      messagesQuery.data?.ticket?.userId !== undefined;

    if (isAgentReply && currentTicketId) {
      // Use the reply endpoint (agent responding to user)
      replyMutation.mutate({
        ticketId: currentTicketId,
        message: msg,
      });
      setInputMessage("");
      return;
    }

    // Otherwise, send as user (technician creating their own support request)
    setLocalMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        senderRole: "user",
        message: msg,
        createdAt: new Date().toISOString(),
      },
    ]);

    setInputMessage("");
    setIsAiTyping(ticketStatus === "AI_HANDLING");

    sendMutation.mutate({
      ticketId: currentTicketId || undefined,
      message: msg,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getStatusBadge = () => {
    const config = statusConfig[ticketStatus] || statusConfig.OPEN;
    const Icon = config.icon;
    return (
      <Badge className={`${config.color} text-xs`}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] sm:h-[calc(100vh-100px)]">
      {/* Chat header */}
      <div className="flex items-center gap-3 p-3 sm:p-4 border-b border-border bg-card rounded-t-lg">
        <Button variant="ghost" size="icon" onClick={onBack} className="flex-shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm sm:text-base">Soporte EVGreen</div>
          <div className="flex items-center gap-2">{getStatusBadge()}</div>
        </div>
        {ticketStatus === "AI_HANDLING" && currentTicketId && (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              requestHumanMutation.mutate({ ticketId: currentTicketId })
            }
            disabled={requestHumanMutation.isPending}
            className="text-xs flex-shrink-0"
          >
            <UserCheck className="w-3 h-3 mr-1" />
            <span className="hidden sm:inline">Hablar con humano</span>
            <span className="sm:hidden">Humano</span>
          </Button>
        )}
      </div>

      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 bg-muted/20"
      >
        {/* Welcome message */}
        {allMessages.length === 0 && !isAiTyping && (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
              <Bot className="w-8 h-8 text-amber-400" />
            </div>
            <h3 className="font-semibold text-lg mb-2">
              Soporte Técnico EVGreen
            </h3>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto">
              Soy tu asistente de soporte. Cuéntame el problema que estás
              experimentando y te ayudaré a resolverlo. Si necesito escalar,
              te conectaré con un agente humano.
            </p>
          </div>
        )}

        {/* Messages */}
        {allMessages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* AI typing indicator */}
        {isAiTyping && (
          <div className="flex items-start gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-amber-400" />
            </div>
            <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1">
                <span
                  className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce"
                  style={{ animationDelay: "0ms" }}
                />
                <span
                  className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce"
                  style={{ animationDelay: "150ms" }}
                />
                <span
                  className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-border p-3 sm:p-4 bg-card rounded-b-lg">
        <div className="flex gap-2 items-end">
          <Textarea
            ref={inputRef}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              ticketStatus === "AI_HANDLING"
                ? "Describe tu problema..."
                : "Escribe tu mensaje..."
            }
            className="min-h-[44px] max-h-[120px] resize-none text-sm"
            rows={1}
          />
          <Button
            onClick={handleSend}
            disabled={
              !inputMessage.trim() ||
              sendMutation.isPending ||
              replyMutation.isPending
            }
            className="bg-amber-500 hover:bg-amber-600 text-white h-11 w-11 p-0 flex-shrink-0"
          >
            {sendMutation.isPending || replyMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MESSAGE BUBBLE
// ============================================================================

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.senderRole === "user";
  const isSystem = message.senderRole === "system";
  const isAi = message.senderRole === "ai";

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <div className="bg-muted/50 text-muted-foreground text-xs px-4 py-2 rounded-full max-w-[90%] sm:max-w-[80%] text-center">
          {message.message}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-start gap-2 ${isUser ? "flex-row-reverse" : ""}`}>
      {!isUser && (
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
            isAi ? "bg-amber-500/20" : "bg-blue-500/20"
          }`}
        >
          {isAi ? (
            <Bot className="w-4 h-4 text-amber-400" />
          ) : (
            <UserCheck className="w-4 h-4 text-blue-400" />
          )}
        </div>
      )}
      <div
        className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-3 sm:px-4 py-2 sm:py-3 ${
          isUser
            ? "bg-amber-600 text-white rounded-tr-sm"
            : "bg-card border border-border rounded-tl-sm"
        }`}
      >
        {!isUser && (
          <div className="text-xs font-medium mb-1 text-muted-foreground">
            {isAi ? "Asistente IA" : "Agente de soporte"}
          </div>
        )}
        <div className={`text-sm ${isUser ? "text-white" : ""}`}>
          {isAi ? (
            <Streamdown>{message.message}</Streamdown>
          ) : (
            <span className="whitespace-pre-wrap">{message.message}</span>
          )}
        </div>
        <div
          className={`text-[10px] mt-1 ${
            isUser ? "text-white/60" : "text-muted-foreground"
          }`}
        >
          {new Date(message.createdAt).toLocaleTimeString("es-CO", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// HISTORY VIEW
// ============================================================================

function HistoryView({
  onBack,
  onOpenTicket,
}: {
  onBack: () => void;
  onOpenTicket: (id: number) => void;
}) {
  const ticketsQuery = trpc.support.myTickets.useQuery();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h2 className="font-semibold text-lg">Mis conversaciones</h2>
      </div>

      {ticketsQuery.isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {ticketsQuery.data?.length === 0 && (
        <Card className="p-8 text-center">
          <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">
            No tienes conversaciones de soporte
          </p>
        </Card>
      )}

      {ticketsQuery.data?.map((ticket: any) => {
        const status = statusConfig[ticket.status] || statusConfig.OPEN;
        const StatusIcon = status.icon;
        return (
          <Card
            key={ticket.id}
            className="p-3 sm:p-4 cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => onOpenTicket(ticket.id)}
          >
            <div className="flex items-start justify-between mb-2 gap-2">
              <div className="font-medium text-sm line-clamp-1 flex-1">
                {ticket.subject}
              </div>
              <Badge className={`${status.color} text-[10px] flex-shrink-0`}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {status.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
              {ticket.description}
            </p>
            <div className="text-[10px] text-muted-foreground">
              {new Date(ticket.createdAt).toLocaleDateString("es-CO", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
