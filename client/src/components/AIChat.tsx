/**
 * Componente de Chat de IA para Green EV
 * Widget flotante y página de pantalla completa
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { Streamdown } from "streamdown";
import {
  Bot,
  Send,
  MessageSquare,
  X,
  Loader2,
  Zap,
  MapPin,
  Navigation,
  TrendingUp,
  Sparkles,
  Plus,
  Trash2,
  MoreVertical,
  ChevronRight,
  Maximize2,
  Minimize2,
  History,
} from "lucide-react";
import { useLocation } from "wouter";

// ============================================================================
// TIPOS
// ============================================================================

interface Message {
  id: number;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: Date;
}

interface Conversation {
  id: number;
  title: string;
  conversationType: string;
  messageCount: number;
  lastMessageAt: Date | null;
}

// ============================================================================
// COMPONENTE DE MENSAJE
// ============================================================================

function ChatMessage({ message, isUser }: { message: Message; isUser: boolean }) {
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <Avatar className={`h-8 w-8 shrink-0 ${isUser ? "bg-primary" : "bg-green-600"}`}>
        <AvatarFallback className={isUser ? "bg-primary text-primary-foreground" : "bg-green-600 text-white"}>
          {isUser ? "U" : <Bot className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2 ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted"
        }`}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
            <Streamdown>{message.content}</Streamdown>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// SUGERENCIAS RÁPIDAS
// ============================================================================

const quickSuggestions = [
  {
    icon: MapPin,
    text: "¿Dónde puedo cargar cerca?",
    prompt: "¿Cuáles son las estaciones de carga más cercanas a mi ubicación?",
  },
  {
    icon: Zap,
    text: "Precio actual del kWh",
    prompt: "¿Cuál es el precio actual del kWh en las estaciones de carga?",
  },
  {
    icon: Navigation,
    text: "Planificar viaje",
    prompt: "Quiero planificar un viaje largo con mi vehículo eléctrico. ¿Puedes ayudarme?",
  },
  {
    icon: TrendingUp,
    text: "Mejores horarios",
    prompt: "¿Cuáles son los mejores horarios para cargar y ahorrar dinero?",
  },
];

// ============================================================================
// WIDGET DE CHAT FLOTANTE
// ============================================================================

export function AIChatWidget() {
  const { user, isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Mutations
  const createConversation = trpc.ai.createConversation.useMutation();
  const sendMessage = trpc.ai.sendMessage.useMutation();

  // Auto-scroll al final
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus en input cuando se abre
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    setIsLoading(true);
    setMessage("");

    try {
      // Crear conversación si no existe
      let currentConversationId = conversationId;
      if (!currentConversationId) {
        const result = await createConversation.mutateAsync({ type: "chat" });
        currentConversationId = result.id;
        setConversationId(result.id);
      }

      // Agregar mensaje del usuario inmediatamente
      const userMessage: Message = {
        id: Date.now(),
        role: "user",
        content: text,
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);

      // Enviar mensaje y obtener respuesta
      const response = await sendMessage.mutateAsync({
        conversationId: currentConversationId,
        message: text,
      });

      // Agregar respuesta del asistente
      const assistantMessage: Message = {
        id: Date.now() + 1,
        role: "assistant",
        content: response.content,
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      toast.error(error.message || "Error al enviar mensaje");
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, isLoading, createConversation, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(message);
    }
  };

  const handleNewChat = () => {
    setConversationId(null);
    setMessages([]);
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      {/* Botón flotante */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center justify-center"
        aria-label="Abrir asistente de IA"
      >
        <Bot className="h-6 w-6" />
        <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-green-500 border-2 border-background" />
      </button>

      {/* Panel de chat */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent
          side="right"
          className="w-full sm:w-[420px] p-0 flex flex-col"
        >
          {/* Header */}
          <SheetHeader className="p-4 border-b bg-primary/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <SheetTitle className="text-base">EV Assistant</SheetTitle>
                  <p className="text-xs text-muted-foreground">
                    Asistente de Green EV
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleNewChat}
                  title="Nueva conversación"
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </SheetHeader>

          {/* Mensajes */}
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">¡Hola, {user?.name?.split(" ")[0] || "Usuario"}!</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-[280px]">
                  Soy tu asistente de Green EV. Puedo ayudarte a encontrar estaciones de carga, planificar viajes y más.
                </p>
                <div className="grid grid-cols-2 gap-2 w-full">
                  {quickSuggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSendMessage(suggestion.prompt)}
                      className="flex items-center gap-2 p-3 rounded-xl border bg-card hover:bg-muted transition-colors text-left"
                    >
                      <suggestion.icon className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-xs">{suggestion.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg) => (
                  <ChatMessage
                    key={msg.id}
                    message={msg}
                    isUser={msg.role === "user"}
                  />
                ))}
                {isLoading && (
                  <div className="flex gap-3">
                    <Avatar className="h-8 w-8 bg-green-600">
                      <AvatarFallback className="bg-green-600 text-white">
                        <Bot className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="bg-muted rounded-2xl px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm text-muted-foreground">
                          Pensando...
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Input */}
          <div className="p-4 border-t bg-background">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribe tu mensaje..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button
                onClick={() => handleSendMessage(message)}
                disabled={!message.trim() || isLoading}
                size="icon"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

// ============================================================================
// PÁGINA DE CHAT COMPLETA
// ============================================================================

export function AIChatPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [message, setMessage] = useState("");
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Queries
  const { data: conversations, refetch: refetchConversations } = trpc.ai.getConversations.useQuery();
  const { data: usageStats } = trpc.ai.getUsageStats.useQuery();

  // Mutations
  const createConversation = trpc.ai.createConversation.useMutation();
  const sendMessageMutation = trpc.ai.sendMessage.useMutation();
  const deleteConversation = trpc.ai.deleteConversation.useMutation({
    onSuccess: () => {
      refetchConversations();
      if (conversationId) {
        handleNewChat();
      }
    },
  });

  // Cargar mensajes cuando cambia la conversación
  const { data: conversationMessages } = trpc.ai.getMessages.useQuery(
    { conversationId: conversationId! },
    { enabled: !!conversationId }
  );

  useEffect(() => {
    if (conversationMessages) {
      setMessages(
        conversationMessages.map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant" | "system",
          content: m.content,
          createdAt: new Date(m.createdAt),
        }))
      );
    }
  }, [conversationMessages]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    setIsLoading(true);
    setMessage("");

    try {
      let currentConversationId = conversationId;
      if (!currentConversationId) {
        const result = await createConversation.mutateAsync({ type: "chat" });
        currentConversationId = result.id;
        setConversationId(result.id);
        refetchConversations();
      }

      const userMessage: Message = {
        id: Date.now(),
        role: "user",
        content: text,
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);

      const response = await sendMessageMutation.mutateAsync({
        conversationId: currentConversationId,
        message: text,
      });

      const assistantMessage: Message = {
        id: Date.now() + 1,
        role: "assistant",
        content: response.content,
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      refetchConversations();
    } catch (error: any) {
      toast.error(error.message || "Error al enviar mensaje");
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, isLoading, createConversation, sendMessageMutation, refetchConversations]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(message);
    }
  };

  const handleNewChat = () => {
    setConversationId(null);
    setMessages([]);
  };

  const handleSelectConversation = (id: number) => {
    setConversationId(id);
    setShowHistory(false);
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-background">
      {/* Sidebar de historial */}
      <div
        className={`${
          showHistory ? "w-80" : "w-0"
        } transition-all duration-300 overflow-hidden border-r bg-muted/30`}
      >
        <div className="p-4 h-full flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <History className="h-4 w-4" />
              Historial
            </h3>
            <Button variant="ghost" size="icon" onClick={() => setShowHistory(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <Button onClick={handleNewChat} className="w-full mb-4" variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Nueva conversación
          </Button>

          <ScrollArea className="flex-1">
            <div className="space-y-2">
              {conversations?.map((conv) => (
                <div
                  key={conv.id}
                  className={`p-3 rounded-lg cursor-pointer transition-colors group ${
                    conversationId === conv.id
                      ? "bg-primary/10 border border-primary/20"
                      : "hover:bg-muted"
                  }`}
                  onClick={() => handleSelectConversation(conv.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{conv.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {conv.messageCount} mensajes
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteConversation.mutate({ conversationId: conv.id });
                          }}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Área principal de chat */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="h-14 border-b flex items-center justify-between px-4 bg-background">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowHistory(!showHistory)}
            >
              <MessageSquare className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">EV Assistant</p>
                <p className="text-xs text-muted-foreground">
                  {isLoading ? "Escribiendo..." : "En línea"}
                </p>
              </div>
            </div>
          </div>

          {usageStats && (
            <Badge variant="outline" className="text-xs">
              {usageStats.userUsageToday}/{usageStats.userLimit} mensajes hoy
            </Badge>
          )}
        </div>

        {/* Mensajes */}
        <ScrollArea className="flex-1 p-6" ref={scrollRef}>
          <div className="max-w-3xl mx-auto">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-16">
                <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                  <Sparkles className="h-10 w-10 text-primary" />
                </div>
                <h2 className="text-2xl font-bold mb-2">
                  ¡Hola, {user?.name?.split(" ")[0] || "Usuario"}!
                </h2>
                <p className="text-muted-foreground mb-8 max-w-md">
                  Soy tu asistente inteligente de Green EV. Puedo ayudarte con:
                </p>
                <div className="grid grid-cols-2 gap-4 w-full max-w-lg">
                  {quickSuggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSendMessage(suggestion.prompt)}
                      className="flex items-center gap-3 p-4 rounded-xl border bg-card hover:bg-muted transition-colors text-left"
                    >
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <suggestion.icon className="h-5 w-5 text-primary" />
                      </div>
                      <span className="text-sm font-medium">{suggestion.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((msg) => (
                  <ChatMessage
                    key={msg.id}
                    message={msg}
                    isUser={msg.role === "user"}
                  />
                ))}
                {isLoading && (
                  <div className="flex gap-3">
                    <Avatar className="h-8 w-8 bg-green-600">
                      <AvatarFallback className="bg-green-600 text-white">
                        <Bot className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="bg-muted rounded-2xl px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm text-muted-foreground">
                          Pensando...
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="p-4 border-t bg-background">
          <div className="max-w-3xl mx-auto">
            <div className="flex gap-3 items-end">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Escribe tu mensaje..."
                  disabled={isLoading}
                  rows={1}
                  className="w-full resize-none rounded-xl border bg-background px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[48px] max-h-[200px]"
                  style={{ height: "auto" }}
                />
              </div>
              <Button
                onClick={() => handleSendMessage(message)}
                disabled={!message.trim() || isLoading}
                size="lg"
                className="h-12 w-12 rounded-xl"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-2">
              EV Assistant puede cometer errores. Verifica la información importante.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AIChatWidget;
