import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";
import UserLayout from "@/layouts/UserLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageCircle,
  Phone,
  Mail,
  HelpCircle,
  ChevronRight,
  Send,
  Zap,
  Bot,
  User,
  AlertTriangle,
  ArrowLeft,
  Loader2,
  UserCheck,
  History,
  ChevronDown,
  Paperclip,
  Image as ImageIcon,
  X,
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
  attachmentUrl?: string | null;
}

// ============================================================================
// PROBLEM TYPES
// ============================================================================

const PROBLEM_TYPES = [
  { value: "NO_ENCIENDE", label: "No enciende", icon: "🔌" },
  { value: "NO_CARGA", label: "No carga el vehículo", icon: "🔋" },
  { value: "CABLE_DANADO", label: "Cable dañado", icon: "⚡" },
  { value: "PANTALLA_ROTA", label: "Pantalla rota", icon: "📱" },
  { value: "CONECTOR_DANADO", label: "Conector dañado", icon: "🔧" },
  { value: "ERROR_COMUNICACION", label: "Error de comunicación", icon: "📡" },
  { value: "COBRO_INCORRECTO", label: "Cobro incorrecto", icon: "💰" },
  { value: "OTRO", label: "Otro problema", icon: "❓" },
] as const;

const FAQ_ITEMS = [
  {
    question: "¿Cómo inicio una carga?",
    answer: "Puedes iniciar una carga escaneando el código QR del cargador o seleccionándolo desde el mapa.",
  },
  {
    question: "¿Cómo recargo mi billetera?",
    answer: "Ve a la sección Billetera, selecciona un monto y completa el pago con tu método de pago preferido.",
  },
  {
    question: "¿Qué hago si el cargador no funciona?",
    answer: "Reporta el problema desde esta sección usando el botón 'Reportar problema con cargador'.",
  },
  {
    question: "¿Cómo cancelo una reserva?",
    answer: "Ve a Mis Reservas y presiona el botón de cancelar. Recuerda que puede aplicar penalización.",
  },
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function UserSupport() {
  const [view, setView] = useState<"main" | "chat" | "report" | "history">("main");
  const [activeTicketId, setActiveTicketId] = useState<number | null>(null);

  return (
    <UserLayout title="Soporte" showBack>
      <AnimatePresence mode="wait">
        {view === "main" && (
          <MainView
            key="main"
            onOpenChat={(ticketId) => { setActiveTicketId(ticketId); setView("chat"); }}
            onOpenReport={() => setView("report")}
            onOpenHistory={() => setView("history")}
          />
        )}
        {view === "chat" && (
          <ChatView
            key="chat"
            ticketId={activeTicketId}
            onBack={() => { setView("main"); setActiveTicketId(null); }}
          />
        )}
        {view === "report" && (
          <ReportView
            key="report"
            onBack={() => setView("main")}
          />
        )}
        {view === "history" && (
          <HistoryView
            key="history"
            onBack={() => setView("main")}
            onOpenTicket={(id) => { setActiveTicketId(id); setView("chat"); }}
          />
        )}
      </AnimatePresence>
    </UserLayout>
  );
}

// ============================================================================
// MAIN VIEW
// ============================================================================

function MainView({ onOpenChat, onOpenReport, onOpenHistory }: {
  onOpenChat: (ticketId: number | null) => void;
  onOpenReport: () => void;
  onOpenHistory: () => void;
}) {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const unreadQuery = trpc.support.unreadCount.useQuery(undefined, {
    refetchInterval: 30000,
  });

  const contactOptions = [
    {
      icon: MessageCircle,
      label: "Chat con IA",
      description: "Asistencia inmediata",
      action: () => onOpenChat(null),
      highlight: true,
    },
    {
      icon: Phone,
      label: "Llamar soporte",
      description: "24/7 disponible",
      action: () => window.open("tel:+573001234567"),
    },
    {
      icon: Mail,
      label: "Enviar email",
      description: "soporte@greenhproject.com",
      action: () => window.open("mailto:soporte@greenhproject.com"),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 0 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="p-4 space-y-6 pb-24"
    >
      {/* Contact options */}
      <div className="grid grid-cols-3 gap-3">
        {contactOptions.map((option, index) => (
          <motion.div
            key={option.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card
              className={`p-4 text-center cursor-pointer card-interactive relative ${
                option.highlight ? "border-emerald-500/50 bg-emerald-500/5" : ""
              }`}
              onClick={option.action}
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 ${
                option.highlight ? "bg-emerald-500/20" : "bg-primary/10"
              }`}>
                <option.icon className={`w-6 h-6 ${option.highlight ? "text-emerald-400" : "text-primary"}`} />
              </div>
              <div className="font-medium text-sm">{option.label}</div>
              <div className="text-xs text-muted-foreground">{option.description}</div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* History button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card
          className="p-4 cursor-pointer card-interactive flex items-center justify-between"
          onClick={onOpenHistory}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
              <History className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="font-medium">Mis conversaciones</div>
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
      </motion.div>

      {/* FAQ */}
      <div>
        <h3 className="font-semibold mb-4">Preguntas frecuentes</h3>
        <div className="space-y-2">
          {FAQ_ITEMS.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + index * 0.05 }}
            >
              <Card
                className="overflow-hidden cursor-pointer"
                onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
              >
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <HelpCircle className="w-5 h-5 text-primary" />
                    <span className="font-medium text-sm">{item.question}</span>
                  </div>
                  <ChevronRight
                    className={`w-5 h-5 text-muted-foreground transition-transform ${
                      expandedFaq === index ? "rotate-90" : ""
                    }`}
                  />
                </div>
                {expandedFaq === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    className="px-4 pb-4 text-muted-foreground text-sm"
                  >
                    {item.answer}
                  </motion.div>
                )}
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Report charger problem */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Card className="p-4 border-orange-500/30 bg-orange-500/5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-orange-400" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-orange-300">¿Problema con un cargador?</h4>
              <p className="text-sm text-orange-400/80 mb-3">
                Reporta daños o fallas para que nuestro equipo técnico lo resuelva rápidamente.
              </p>
              <Button
                variant="outline"
                className="border-orange-500/50 text-orange-300 hover:bg-orange-500/10"
                onClick={onOpenReport}
              >
                <Zap className="w-4 h-4 mr-2" />
                Reportar problema
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}

// ============================================================================
// CHAT VIEW (AI + Human)
// ============================================================================

function ChatView({ ticketId, onBack }: { ticketId: number | null; onBack: () => void }) {
  const [currentTicketId, setCurrentTicketId] = useState<number | null>(ticketId);
  const [inputMessage, setInputMessage] = useState("");
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [ticketStatus, setTicketStatus] = useState<string>("AI_HANDLING");
  const [pendingLocalIds, setPendingLocalIds] = useState<Set<number>>(new Set());
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load existing messages if ticket exists
  const messagesQuery = trpc.support.getMessages.useQuery(
    { ticketId: currentTicketId! },
    { enabled: !!currentTicketId, refetchInterval: ticketStatus !== "AI_HANDLING" ? 5000 : 10000 }
  );

  // Send message mutation
  const sendMutation = trpc.support.sendMessage.useMutation({
    onSuccess: (result) => {
      setCurrentTicketId(result.ticketId);
      if (result.status) setTicketStatus(result.status);

      if (result.aiResponse) {
        const aiMsgId = Date.now();
        setLocalMessages(prev => [...prev, {
          id: aiMsgId,
          senderRole: result.escalated ? "system" as const : "ai" as const,
          message: result.aiResponse!,
          createdAt: new Date().toISOString(),
        }]);
        setPendingLocalIds(prev => new Set(prev).add(aiMsgId));
        // If escalated, add the system message too
        if (result.escalated && result.status === "ASSIGNED") {
          const sysMsgId = Date.now() + 1;
          setLocalMessages(prev => [...prev, {
            id: sysMsgId,
            senderRole: "system",
            message: "Tu conversación ha sido transferida a un agente de soporte. Te responderá en breve.",
            createdAt: new Date().toISOString(),
          }]);
          setPendingLocalIds(prev => new Set(prev).add(sysMsgId));
        }
      }
      setIsAiTyping(false);
      // Refetch server messages to sync
      messagesQuery.refetch();
    },
    onError: () => {
      setIsAiTyping(false);
      toast.error("Error al enviar mensaje. Intenta de nuevo.");
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
    { ticketId: currentTicketId! },
    { enabled: !!currentTicketId && ticketStatus !== "AI_HANDLING", refetchInterval: 2000 }
  );

  // Debounced typing indicator
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleTypingStart = useCallback(() => {
    if (!currentTicketId || ticketStatus === "AI_HANDLING") return;
    setTypingMutation.mutate({ ticketId: currentTicketId, isTyping: true });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      if (currentTicketId) setTypingMutation.mutate({ ticketId: currentTicketId, isTyping: false });
    }, 3000);
  }, [currentTicketId, ticketStatus]);

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
    if (!imageFile || !currentTicketId || isUploading) return;
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadMutation.mutate({
        ticketId: currentTicketId,
        fileName: imageFile.name,
        fileBase64: base64,
        contentType: imageFile.type,
      });
    };
    reader.readAsDataURL(imageFile);
  };

  // Request human agent
  const requestHumanMutation = trpc.support.requestHumanAgent.useMutation({
    onSuccess: (result) => {
      setTicketStatus(result.hasAgent ? "ASSIGNED" : "WAITING_AGENT");
      messagesQuery.refetch();
      toast.success(result.hasAgent
        ? "Te hemos conectado con un agente de soporte"
        : "Tu solicitud ha sido registrada. Te responderemos pronto."
      );
    },
  });

  // Merge server messages with local pending ones
  // Once server data arrives, use it as source of truth and only append local messages
  // that haven't been synced yet (pending ones added optimistically)
  const allMessages = useMemo(() => {
    const serverMessages = messagesQuery.data?.messages as unknown as ChatMessage[] | undefined;
    if (serverMessages && serverMessages.length > 0) {
      // Server has messages - use them as base
      // Only append local messages that are newer than the last server message
      const lastServerTime = new Date(serverMessages[serverMessages.length - 1].createdAt).getTime();
      const pendingLocal = localMessages.filter(lm => {
        const localTime = new Date(lm.createdAt).getTime();
        return localTime > lastServerTime && pendingLocalIds.has(lm.id);
      });
      return [...serverMessages, ...pendingLocal];
    }
    // No server data yet - show local messages
    return localMessages;
  }, [messagesQuery.data, localMessages, pendingLocalIds]);

  // When server messages update, clear synced local messages
  useEffect(() => {
    if (messagesQuery.data?.messages && (messagesQuery.data.messages as unknown as ChatMessage[]).length > 0) {
      // Clear local messages that are now on the server
      const serverCount = (messagesQuery.data.messages as unknown as ChatMessage[]).length;
      if (serverCount > 0) {
        // Keep only truly pending local messages
        setPendingLocalIds(new Set());
      }
    }
  }, [messagesQuery.data]);

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
    if (!msg || sendMutation.isPending) return;

    // Add user message locally for optimistic display
    const localId = Date.now();
    setLocalMessages(prev => [...prev, {
      id: localId,
      senderRole: "user",
      message: msg,
      createdAt: new Date().toISOString(),
    }]);
    setPendingLocalIds(prev => new Set(prev).add(localId));

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
    switch (ticketStatus) {
      case "AI_HANDLING":
        return <Badge className="bg-emerald-500/20 text-emerald-400 text-xs"><Bot className="w-3 h-3 mr-1" /> Asistente IA</Badge>;
      case "ASSIGNED":
        return <Badge className="bg-blue-500/20 text-blue-400 text-xs"><UserCheck className="w-3 h-3 mr-1" /> Agente conectado</Badge>;
      case "WAITING_AGENT":
        return <Badge className="bg-yellow-500/20 text-yellow-400 text-xs"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Esperando agente</Badge>;
      case "RESOLVED":
        return <Badge className="bg-gray-500/20 text-gray-400 text-xs">Resuelto</Badge>;
      default:
        return <Badge className="bg-primary/20 text-primary text-xs">Abierto</Badge>;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="flex flex-col h-[calc(100vh-64px)]"
    >
      {/* Chat header */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="font-semibold">Soporte EVGreen</div>
          <div className="flex items-center gap-2">
            {getStatusBadge()}
          </div>
        </div>
        {ticketStatus === "AI_HANDLING" && currentTicketId && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => requestHumanMutation.mutate({ ticketId: currentTicketId })}
            disabled={requestHumanMutation.isPending}
            className="text-xs"
          >
            <UserCheck className="w-3 h-3 mr-1" />
            Hablar con humano
          </Button>
        )}
      </div>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Welcome message */}
        {allMessages.length === 0 && !isAiTyping && (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <Bot className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Asistente de Soporte EVGreen</h3>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto">
              Soy tu asistente virtual. Cuéntame tu problema y haré lo posible por ayudarte.
              Si necesitas atención personalizada, te conectaré con un agente humano.
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
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Typing indicator from agent */}
      {typingQuery.data && typingQuery.data.length > 0 && (
        <div className="px-4 pb-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
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
            className="ml-2 gradient-primary text-white"
          >
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enviar imagen"}
          </Button>
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-border p-4 bg-background">
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
            className="h-11 w-11 flex-shrink-0 text-muted-foreground hover:text-emerald-400"
            onClick={() => fileInputRef.current?.click()}
            title="Adjuntar imagen"
          >
            <Paperclip className="w-5 h-5" />
          </Button>
          <Textarea
            ref={inputRef}
            value={inputMessage}
            onChange={(e) => {
              setInputMessage(e.target.value);
              handleTypingStart();
            }}
            onKeyDown={handleKeyDown}
            placeholder={ticketStatus === "AI_HANDLING" ? "Escribe tu pregunta..." : "Escribe tu mensaje..."}
            className="min-h-[44px] max-h-[120px] resize-none"
            rows={1}
          />
          <Button
            onClick={handleSend}
            disabled={!inputMessage.trim() || sendMutation.isPending}
            className="gradient-primary text-white h-11 w-11 p-0 flex-shrink-0"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </motion.div>
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
        <div className="bg-muted/50 text-muted-foreground text-xs px-4 py-2 rounded-full max-w-[80%] text-center">
          {message.message}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-start gap-2 ${isUser ? "flex-row-reverse" : ""}`}>
      {!isUser && (
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isAi ? "bg-emerald-500/20" : "bg-blue-500/20"
        }`}>
          {isAi ? (
            <Bot className="w-4 h-4 text-emerald-400" />
          ) : (
            <UserCheck className="w-4 h-4 text-blue-400" />
          )}
        </div>
      )}
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
        isUser
          ? "bg-emerald-600 text-white rounded-tr-sm"
          : "bg-card border border-border rounded-tl-sm"
      }`}>
        {!isUser && (
          <div className="text-xs font-medium mb-1 text-muted-foreground">
            {isAi ? "Asistente IA" : "Agente de soporte"}
          </div>
        )}
        {message.attachmentUrl && (
          <div className="mb-2">
            <img
              src={message.attachmentUrl}
              alt="Adjunto"
              className="max-w-full max-h-48 rounded-lg cursor-pointer object-contain"
              onClick={() => window.open(message.attachmentUrl!, "_blank")}
            />
          </div>
        )}
        {message.message && (
          <div className={`text-sm ${isUser ? "text-white" : ""}`}>
            {isAi ? (
              <Streamdown>{message.message}</Streamdown>
            ) : (
              <span className="whitespace-pre-wrap">{message.message}</span>
            )}
          </div>
        )}
        <div className={`text-[10px] mt-1 ${isUser ? "text-white/60" : "text-muted-foreground"}`}>
          {new Date(message.createdAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// REPORT VIEW (Problem with charger)
// ============================================================================

function ReportView({ onBack }: { onBack: () => void }) {
  const [problemType, setProblemType] = useState("");
  const [description, setDescription] = useState("");
  const [selectedStation, setSelectedStation] = useState<{ id: number; name: string } | null>(null);
  const [showStationPicker, setShowStationPicker] = useState(false);
  const [stationSearch, setStationSearch] = useState("");

  // Get stations list
  const stationsQuery = trpc.stations.listPublic.useQuery();

  const filteredStations = useMemo(() => {
    if (!stationsQuery.data) return [];
    const search = stationSearch.toLowerCase();
    return stationsQuery.data.filter((s: any) =>
      s.name.toLowerCase().includes(search) ||
      s.address?.toLowerCase().includes(search)
    ).slice(0, 20);
  }, [stationsQuery.data, stationSearch]);

  const reportMutation = trpc.support.reportProblem.useMutation({
    onSuccess: () => {
      toast.success("Reporte enviado exitosamente. Nuestro equipo técnico lo revisará pronto.");
      onBack();
    },
    onError: (err) => {
      toast.error(err.message || "Error al enviar el reporte");
    },
  });

  const handleSubmit = () => {
    if (!selectedStation) {
      toast.error("Selecciona la estación con el problema");
      return;
    }
    if (!problemType) {
      toast.error("Selecciona el tipo de problema");
      return;
    }

    reportMutation.mutate({
      stationId: selectedStation.id,
      stationName: selectedStation.name,
      problemType: problemType as any,
      description: description || undefined,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="p-4 space-y-6 pb-24"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="font-semibold text-lg">Reportar problema</h2>
          <p className="text-sm text-muted-foreground">Ayúdanos a mantener los cargadores en buen estado</p>
        </div>
      </div>

      {/* Station selector */}
      <Card className="p-4">
        <label className="text-sm font-medium mb-2 block">Estación con el problema</label>
        <Button
          variant="outline"
          className="w-full justify-between text-left h-auto py-3"
          onClick={() => setShowStationPicker(true)}
        >
          <span className={selectedStation ? "" : "text-muted-foreground"}>
            {selectedStation ? selectedStation.name : "Seleccionar estación..."}
          </span>
          <ChevronDown className="w-4 h-4 ml-2 text-muted-foreground" />
        </Button>
      </Card>

      {/* Station picker dialog */}
      <Dialog open={showStationPicker} onOpenChange={setShowStationPicker}>
        <DialogContent className="max-w-md max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Seleccionar estación</DialogTitle>
            <DialogDescription>Busca y selecciona la estación donde ocurre el problema</DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Buscar por nombre o dirección..."
            value={stationSearch}
            onChange={(e) => setStationSearch(e.target.value)}
            className="mb-3"
          />
          <ScrollArea className="h-[300px]">
            <div className="space-y-2">
              {filteredStations.map((station: any) => (
                <Card
                  key={station.id}
                  className={`p-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                    selectedStation?.id === station.id ? "border-emerald-500 bg-emerald-500/10" : ""
                  }`}
                  onClick={() => {
                    setSelectedStation({ id: station.id, name: station.name });
                    setShowStationPicker(false);
                  }}
                >
                  <div className="font-medium text-sm">{station.name}</div>
                  <div className="text-xs text-muted-foreground">{station.address || "Sin dirección"}</div>
                </Card>
              ))}
              {filteredStations.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No se encontraron estaciones
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Problem type */}
      <Card className="p-4">
        <label className="text-sm font-medium mb-3 block">Tipo de problema</label>
        <div className="grid grid-cols-2 gap-2">
          {PROBLEM_TYPES.map((type) => (
            <Card
              key={type.value}
              className={`p-3 cursor-pointer transition-colors text-center ${
                problemType === type.value
                  ? "border-orange-500 bg-orange-500/10"
                  : "hover:bg-muted/50"
              }`}
              onClick={() => setProblemType(type.value)}
            >
              <div className="text-2xl mb-1">{type.icon}</div>
              <div className="text-xs font-medium">{type.label}</div>
            </Card>
          ))}
        </div>
      </Card>

      {/* Description */}
      <Card className="p-4">
        <label className="text-sm font-medium mb-2 block">Descripción adicional (opcional)</label>
        <Textarea
          placeholder="Describe brevemente el problema..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="min-h-[80px]"
          maxLength={500}
        />
        <div className="text-xs text-muted-foreground text-right mt-1">{description.length}/500</div>
      </Card>

      {/* Submit */}
      <Button
        className="w-full gradient-primary text-white h-12"
        onClick={handleSubmit}
        disabled={reportMutation.isPending}
      >
        {reportMutation.isPending ? (
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
        ) : (
          <AlertTriangle className="w-5 h-5 mr-2" />
        )}
        Enviar reporte
      </Button>
    </motion.div>
  );
}

// ============================================================================
// HISTORY VIEW
// ============================================================================

function HistoryView({ onBack, onOpenTicket }: { onBack: () => void; onOpenTicket: (id: number) => void }) {
  const ticketsQuery = trpc.support.myTickets.useQuery();

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "AI_HANDLING": return { label: "IA atendiendo", color: "bg-emerald-500/20 text-emerald-400" };
      case "ASSIGNED": return { label: "Agente asignado", color: "bg-blue-500/20 text-blue-400" };
      case "WAITING_AGENT": return { label: "En espera", color: "bg-yellow-500/20 text-yellow-400" };
      case "RESOLVED": return { label: "Resuelto", color: "bg-gray-500/20 text-gray-400" };
      case "OPEN": return { label: "Abierto", color: "bg-orange-500/20 text-orange-400" };
      default: return { label: status, color: "bg-muted text-muted-foreground" };
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="p-4 space-y-4 pb-24"
    >
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
        <div className="text-center py-12">
          <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No tienes conversaciones de soporte</p>
        </div>
      )}

      {ticketsQuery.data?.map((ticket: any) => {
        const status = getStatusLabel(ticket.status);
        return (
          <Card
            key={ticket.id}
            className="p-4 cursor-pointer card-interactive"
            onClick={() => onOpenTicket(ticket.id)}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="font-medium text-sm line-clamp-1 flex-1">{ticket.subject}</div>
              <Badge className={`${status.color} text-[10px] ml-2 flex-shrink-0`}>
                {status.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{ticket.description}</p>
            <div className="text-[10px] text-muted-foreground">
              {new Date(ticket.createdAt).toLocaleDateString("es-CO", {
                day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
              })}
            </div>
          </Card>
        );
      })}
    </motion.div>
  );
}
