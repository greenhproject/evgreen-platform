/**
 * Componente de Chat de IA para EVGreen
 * Widget flotante y página de pantalla completa
 * Con escritura progresiva (streaming simulado) y auto-scroll
 * Integración con Google Maps para rutas a estaciones
 * Planificador de rutas inteligente con paradas de carga
 * Reserva de cargadores desde el chat
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
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
  History,
  ExternalLink,
  Route,
  CalendarClock,
  CheckCircle2,
  MapPinned,
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
  isStreaming?: boolean;
}

interface Conversation {
  id: number;
  title: string;
  conversationType: string;
  messageCount: number;
  lastMessageAt: Date | null;
}

// Hook para obtener ubicación GPS del usuario
function useUserLocation() {
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocalización no soportada');
      return;
    }

    // Intentar obtener ubicación inmediatamente
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setLocationError(null);
      },
      (err) => {
        console.warn('[GPS] Error getting location:', err.message);
        setLocationError(err.message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );

    // Observar cambios de ubicación
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setLocationError(null);
      },
      (err) => {
        console.warn('[GPS] Watch error:', err.message);
      },
      { enableHighAccuracy: false, timeout: 30000, maximumAge: 120000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return { location, locationError };
}

// ============================================================================
// HOOK DE ESCRITURA PROGRESIVA
// ============================================================================

function useProgressiveText(fullText: string, isActive: boolean, speed: number = 12) {
  const [displayedText, setDisplayedText] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const indexRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isActive || !fullText) {
      setDisplayedText(fullText || "");
      setIsComplete(true);
      return;
    }

    setDisplayedText("");
    setIsComplete(false);
    indexRef.current = 0;

    const words = fullText.split(/(\s+)/);
    let wordIndex = 0;
    let accumulated = "";

    intervalRef.current = setInterval(() => {
      if (wordIndex < words.length) {
        const wordsPerTick = Math.min(2, words.length - wordIndex);
        for (let i = 0; i < wordsPerTick; i++) {
          accumulated += words[wordIndex];
          wordIndex++;
        }
        setDisplayedText(accumulated);
      } else {
        setIsComplete(true);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    }, speed);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fullText, isActive, speed]);

  const skipToEnd = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setDisplayedText(fullText);
    setIsComplete(true);
  }, [fullText]);

  return { displayedText, isComplete, skipToEnd };
}

// ============================================================================
// COMPONENTE DE MENSAJE CON STREAMING
// ============================================================================

function ChatMessage({
  message,
  isUser,
  isLatestAssistant,
  onStreamComplete,
  onReservationConfirm,
}: {
  message: Message;
  isUser: boolean;
  isLatestAssistant: boolean;
  onStreamComplete?: () => void;
  onReservationConfirm?: (stationId: number, evseId: number, startTime: string, duration: number) => void;
}) {
  const shouldStream = isLatestAssistant && message.isStreaming;
  const { displayedText, isComplete, skipToEnd } = useProgressiveText(
    message.content,
    shouldStream || false,
    15
  );

  useEffect(() => {
    if (isComplete && shouldStream && onStreamComplete) {
      onStreamComplete();
    }
  }, [isComplete, shouldStream, onStreamComplete]);

  const rawText = shouldStream ? displayedText : message.content;
  // Limpiar todos los tags especiales del texto visible
  const cleanText = rawText
    .replace(/\[NAV:(-?\d+\.?\d*),\s*(-?\d+\.?\d*)\|([^\]]+)\]/g, '')
    .replace(/\[ROUTE:([^\]]+)\]/g, '')
    .replace(/\[RESERVE:([^\]]+)\]/g, '');

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <Avatar className={`h-8 w-8 shrink-0 ${isUser ? "bg-primary" : "bg-green-600"}`}>
        <AvatarFallback className={isUser ? "bg-primary text-primary-foreground" : "bg-green-600 text-white"}>
          {isUser ? "U" : <Bot className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2 ${
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        }`}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
            <Streamdown>{cleanText}</Streamdown>
            {shouldStream && !isComplete && (
              <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5 align-middle" />
            )}
            {shouldStream && !isComplete && (
              <button
                onClick={skipToEnd}
                className="block mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Mostrar todo ↓
              </button>
            )}
            {/* Action buttons - only show when streaming is complete */}
            {!isUser && isComplete && (
              <>
                <NavigationButtons content={rawText} />
                <RouteButton content={rawText} />
                <ReservationButton content={rawText} onConfirm={onReservationConfirm} />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// BOTONES DE NAVEGACIÓN (Google Maps) - Solo para consultas de ubicación
// ============================================================================

function NavigationButtons({ content }: { content: string }) {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {}
      );
    }
  }, []);

  // SOLO detectar tags [NAV:lat,lng|nombre] explícitos del LLM
  const navMatches: { lat: number; lng: number; name: string }[] = [];
  const navTagRegex = /\[NAV:(-?\d+\.?\d*),\s*(-?\d+\.?\d*)\|([^\]]+)\]/g;
  let m;
  while ((m = navTagRegex.exec(content)) !== null) {
    navMatches.push({
      lat: parseFloat(m[1]),
      lng: parseFloat(m[2]),
      name: m[3].trim(),
    });
  }

  // Si no hay tags NAV explícitos, NO mostrar nada
  if (navMatches.length === 0) return null;

  const openGoogleMapsCoords = (lat: number, lng: number) => {
    let url: string;
    if (userLocation) {
      url = `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${lat},${lng}&travelmode=driving`;
    } else {
      url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    }
    window.open(url, "_blank");
  };

  return (
    <div className="mt-3 space-y-2">
      {navMatches.slice(0, 3).map((nav, i) => (
        <button
          key={i}
          onClick={() => openGoogleMapsCoords(nav.lat, nav.lng)}
          className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl bg-gradient-to-r from-blue-600/10 to-green-600/10 text-blue-500 hover:from-blue-600/20 hover:to-green-600/20 transition-all text-sm font-medium border border-blue-500/20 active:scale-[0.98]"
        >
          <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
            <Navigation className="h-4 w-4" />
          </div>
          <div className="flex-1 text-left">
            <span className="block text-xs font-semibold">{nav.name}</span>
            <span className="block text-[10px] text-muted-foreground">Abrir ruta en Google Maps</span>
          </div>
          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// BOTÓN DE RUTA COMPLETA (Planificador de viajes)
// ============================================================================

function RouteButton({ content }: { content: string }) {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {}
      );
    }
  }, []);

  // Detectar tag [ROUTE:lat1,lng1|lat2,lng2|...|nombre]
  const routeRegex = /\[ROUTE:([^\]]+)\]/;
  const routeMatch = content.match(routeRegex);
  
  if (!routeMatch) return null;

  const parts = routeMatch[1].split('|');
  if (parts.length < 3) return null; // Mínimo: origen, destino, nombre

  const routeName = parts[parts.length - 1].trim();
  const waypoints: { lat: number; lng: number }[] = [];
  
  for (let i = 0; i < parts.length - 1; i++) {
    const coords = parts[i].split(',');
    if (coords.length === 2) {
      const lat = parseFloat(coords[0].trim());
      const lng = parseFloat(coords[1].trim());
      if (!isNaN(lat) && !isNaN(lng)) {
        waypoints.push({ lat, lng });
      }
    }
  }

  if (waypoints.length < 2) return null;

  const openRouteInMaps = () => {
    const origin = waypoints[0];
    const destination = waypoints[waypoints.length - 1];
    const intermediateStops = waypoints.slice(1, -1);

    // Usar ubicación actual como origen si está disponible y el primer waypoint es el origen
    const actualOrigin = userLocation || origin;

    let url = `https://www.google.com/maps/dir/?api=1&origin=${actualOrigin.lat},${actualOrigin.lng}&destination=${destination.lat},${destination.lng}&travelmode=driving`;
    
    if (intermediateStops.length > 0) {
      const waypointsStr = intermediateStops.map(w => `${w.lat},${w.lng}`).join('|');
      url += `&waypoints=${encodeURIComponent(waypointsStr)}`;
    }

    window.open(url, "_blank");
  };

  return (
    <div className="mt-3">
      <button
        onClick={openRouteInMaps}
        className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-600/15 to-blue-600/15 text-emerald-600 hover:from-emerald-600/25 hover:to-blue-600/25 transition-all text-sm font-medium border border-emerald-500/20 active:scale-[0.98]"
      >
        <div className="h-10 w-10 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
          <Route className="h-5 w-5" />
        </div>
        <div className="flex-1 text-left">
          <span className="block text-sm font-semibold">{routeName}</span>
          <span className="block text-[11px] text-muted-foreground">
            {waypoints.length - 2} parada{waypoints.length - 2 !== 1 ? 's' : ''} de carga · Abrir ruta completa en Google Maps
          </span>
        </div>
        <div className="flex items-center gap-1">
          <MapPinned className="h-4 w-4" />
          <ExternalLink className="h-3.5 w-3.5" />
        </div>
      </button>
    </div>
  );
}

// ============================================================================
// BOTÓN DE RESERVA
// ============================================================================

function ReservationButton({ 
  content, 
  onConfirm 
}: { 
  content: string;
  onConfirm?: (stationId: number, evseId: number, startTime: string, duration: number) => void;
}) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isReserved, setIsReserved] = useState(false);

  // Detectar tag [RESERVE:stationId,evseId,startTime,duration]
  const reserveRegex = /\[RESERVE:(\d+),(\d+),([^,]+),(\d+)\]/;
  const reserveMatch = content.match(reserveRegex);
  
  if (!reserveMatch) return null;

  const stationId = parseInt(reserveMatch[1]);
  const evseId = parseInt(reserveMatch[2]);
  const startTime = reserveMatch[3].trim();
  const duration = parseInt(reserveMatch[4]);

  const handleConfirm = () => {
    setIsConfirming(true);
    if (onConfirm) {
      onConfirm(stationId, evseId, startTime, duration);
    }
    setTimeout(() => {
      setIsConfirming(false);
      setIsReserved(true);
    }, 2000);
  };

  if (isReserved) {
    return (
      <div className="mt-3">
        <div className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-green-600/15 text-green-600 text-sm font-medium border border-green-500/20">
          <CheckCircle2 className="h-5 w-5" />
          <div className="flex-1">
            <span className="block text-sm font-semibold">Reserva confirmada</span>
            <span className="block text-[11px] text-muted-foreground">
              {new Date(startTime).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })} · {duration} min
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <button
        onClick={handleConfirm}
        disabled={isConfirming}
        className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-gradient-to-r from-purple-600/15 to-indigo-600/15 text-purple-600 hover:from-purple-600/25 hover:to-indigo-600/25 transition-all text-sm font-medium border border-purple-500/20 active:scale-[0.98] disabled:opacity-50"
      >
        <div className="h-10 w-10 rounded-full bg-purple-500/15 flex items-center justify-center shrink-0">
          {isConfirming ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <CalendarClock className="h-5 w-5" />
          )}
        </div>
        <div className="flex-1 text-left">
          <span className="block text-sm font-semibold">
            {isConfirming ? "Reservando..." : "Confirmar reserva"}
          </span>
          <span className="block text-[11px] text-muted-foreground">
            {new Date(startTime).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })} · {duration} min
          </span>
        </div>
        <CalendarClock className="h-4 w-4 shrink-0" />
      </button>
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
    prompt: "¿Cuáles son las estaciones de carga más cercanas a mi ubicación? Dame las direcciones para poder ir.",
  },
  {
    icon: Zap,
    text: "Analiza mi consumo",
    prompt: "Analiza mi historial de consumo de energía y dame recomendaciones para ahorrar en mis cargas.",
  },
  {
    icon: Route,
    text: "Planificar un viaje",
    prompt: "Quiero planificar un viaje largo. ¿Puedes ayudarme a calcular las paradas de carga necesarias según la autonomía de mi vehículo?",
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

const AI_CHAT_OPEN_EVENT = "ai-chat-open";

export function openAIChatWithQuestion(question: string) {
  window.dispatchEvent(new CustomEvent(AI_CHAT_OPEN_EVENT, { detail: { question } }));
}

export function AIChatWidget() {
  const { user, isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [streamingMessageId, setStreamingMessageId] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { location: userGpsLocation } = useUserLocation();

  // Mutations
  const createConversation = trpc.ai.createConversation.useMutation();
  const sendMessage = trpc.ai.sendMessage.useMutation();
  const createReservation = trpc.reservations.create.useMutation();

  // Auto-scroll continuo durante streaming
  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current;
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    if (streamingMessageId === null) return;
    const interval = setInterval(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      }
    }, 100);
    return () => clearInterval(interval);
  }, [streamingMessageId]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleOpenChat = (e: CustomEvent<{ question: string }>) => {
      setIsOpen(true);
      setPendingQuestion(e.detail.question);
    };
    window.addEventListener(AI_CHAT_OPEN_EVENT, handleOpenChat as EventListener);
    return () => {
      window.removeEventListener(AI_CHAT_OPEN_EVENT, handleOpenChat as EventListener);
    };
  }, []);

  useEffect(() => {
    if (isOpen && pendingQuestion && !isLoading) {
      const question = pendingQuestion;
      setPendingQuestion(null);
      setTimeout(() => {
        handleSendMessage(question);
      }, 300);
    }
  }, [isOpen, pendingQuestion, isLoading]);

  const handleReservationConfirm = useCallback(
    async (stationId: number, evseId: number, startTime: string, durationMinutes: number) => {
      try {
        const start = new Date(startTime);
        const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
        
        const result = await createReservation.mutateAsync({
          stationId,
          evseId,
          startTime: start,
          endTime: end,
          estimatedDurationMinutes: durationMinutes,
        });

        toast.success(`Reserva #${result.id} confirmada. Tarifa: $${result.reservationFee?.toLocaleString('es-CO')} COP`);
        
        // Agregar mensaje de confirmación al chat
        const confirmMsg: Message = {
          id: Date.now() + 100,
          role: "assistant",
          content: `✅ **Reserva confirmada exitosamente**\n\n- **ID de reserva:** #${result.id}\n- **Hora:** ${start.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}\n- **Duración:** ${durationMinutes} minutos\n- **Tarifa de reserva:** $${result.reservationFee?.toLocaleString('es-CO')} COP\n\nRecuerda llegar a tiempo. Tienes 15 minutos de gracia después de la hora de inicio.`,
          createdAt: new Date(),
          isStreaming: true,
        };
        setMessages((prev) => [...prev, confirmMsg]);
        setStreamingMessageId(confirmMsg.id);
      } catch (error: any) {
        toast.error(error.message || "Error al crear la reserva");
        const errorMsg: Message = {
          id: Date.now() + 100,
          role: "assistant",
          content: `❌ No se pudo completar la reserva: ${error.message || 'Error desconocido'}. ¿Quieres intentar con otra estación u horario?`,
          createdAt: new Date(),
          isStreaming: true,
        };
        setMessages((prev) => [...prev, errorMsg]);
        setStreamingMessageId(errorMsg.id);
      }
    },
    [createReservation]
  );

  const handleSendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      setIsLoading(true);
      setMessage("");

      try {
        let currentConversationId = conversationId;
        if (!currentConversationId) {
          const result = await createConversation.mutateAsync({ type: "chat" });
          currentConversationId = result.id;
          setConversationId(result.id);
        }

        const userMessage: Message = {
          id: Date.now(),
          role: "user",
          content: text,
          createdAt: new Date(),
        };
        setMessages((prev) => [...prev, userMessage]);

        const response = await sendMessage.mutateAsync({
          conversationId: currentConversationId,
          message: text,
          context: userGpsLocation ? {
            currentLatitude: userGpsLocation.latitude,
            currentLongitude: userGpsLocation.longitude,
          } : undefined,
        });

        const assistantMsgId = Date.now() + 1;
        const assistantMessage: Message = {
          id: assistantMsgId,
          role: "assistant",
          content: response.content,
          createdAt: new Date(),
          isStreaming: true,
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setStreamingMessageId(assistantMsgId);
      } catch (error: any) {
        toast.error(error.message || "Error al enviar mensaje");
      } finally {
        setIsLoading(false);
      }
    },
    [conversationId, isLoading, createConversation, sendMessage, userGpsLocation]
  );

  const handleStreamComplete = useCallback(() => {
    setStreamingMessageId(null);
    setMessages((prev) =>
      prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m))
    );
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(message);
    }
  };

  const handleNewChat = () => {
    setConversationId(null);
    setMessages([]);
    setStreamingMessageId(null);
  };

  if (!isAuthenticated) {
    return null;
  }

  const lastAssistantMsgId = [...messages].reverse().find((m) => m.role === "assistant")?.id;

  return (
    <>
      {/* Botón flotante */}
      <button
        data-ai-chat-trigger
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 sm:bottom-6 right-4 sm:right-6 z-40 h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center justify-center"
        aria-label="Abrir asistente de IA"
      >
        <Bot className="h-5 w-5 sm:h-6 sm:w-6" />
        <span className="absolute -top-1 -right-1 h-3 w-3 sm:h-4 sm:w-4 rounded-full bg-green-500 border-2 border-background" />
      </button>

      {/* Panel de chat */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent
          side="right"
          className="!w-full sm:!w-[420px] !max-w-full sm:!max-w-[420px] p-0 flex flex-col !h-[100dvh] !gap-0"
        >
          {/* Header */}
          <SheetHeader className="shrink-0 p-4 border-b bg-primary/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <SheetTitle className="text-base">EV Assistant</SheetTitle>
                  <p className="text-xs text-muted-foreground">
                    {isLoading ? "Pensando..." : streamingMessageId ? "Escribiendo..." : "Asistente EVGreen"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleNewChat}
                  title="Nueva conversación"
                  className="h-9 w-9 rounded-full bg-primary/10 hover:bg-primary/20"
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <SheetClose asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Cerrar"
                    className="h-9 w-9 rounded-full hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </SheetClose>
              </div>
            </div>
          </SheetHeader>

          {/* Mensajes */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">
                  ¡Hola, {user?.name?.split(" ")[0] || "Usuario"}!
                </h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Soy tu asistente de EVGreen. Puedo ayudarte a encontrar estaciones, planificar viajes, reservar cargadores y más.
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
                    isLatestAssistant={msg.id === lastAssistantMsgId}
                    onStreamComplete={handleStreamComplete}
                    onReservationConfirm={handleReservationConfirm}
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
                        <span className="text-sm text-muted-foreground">Pensando...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Input */}
          <div className="shrink-0 p-4 border-t bg-background pb-[max(1rem,env(safe-area-inset-bottom))]">
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
  const [streamingMessageId, setStreamingMessageId] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { location: userGpsLocation } = useUserLocation();

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
  const createReservation = trpc.reservations.create.useMutation();

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

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    if (streamingMessageId === null) return;
    const interval = setInterval(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      }
    }, 100);
    return () => clearInterval(interval);
  }, [streamingMessageId]);

  const handleReservationConfirm = useCallback(
    async (stationId: number, evseId: number, startTime: string, durationMinutes: number) => {
      try {
        const start = new Date(startTime);
        const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
        
        const result = await createReservation.mutateAsync({
          stationId,
          evseId,
          startTime: start,
          endTime: end,
          estimatedDurationMinutes: durationMinutes,
        });

        toast.success(`Reserva #${result.id} confirmada`);
        
        const confirmMsg: Message = {
          id: Date.now() + 100,
          role: "assistant",
          content: `✅ **Reserva confirmada exitosamente**\n\n- **ID de reserva:** #${result.id}\n- **Hora:** ${start.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}\n- **Duración:** ${durationMinutes} minutos\n- **Tarifa de reserva:** $${result.reservationFee?.toLocaleString('es-CO')} COP\n\nRecuerda llegar a tiempo. Tienes 15 minutos de gracia después de la hora de inicio.`,
          createdAt: new Date(),
          isStreaming: true,
        };
        setMessages((prev) => [...prev, confirmMsg]);
        setStreamingMessageId(confirmMsg.id);
      } catch (error: any) {
        toast.error(error.message || "Error al crear la reserva");
        const errorMsg: Message = {
          id: Date.now() + 100,
          role: "assistant",
          content: `❌ No se pudo completar la reserva: ${error.message || 'Error desconocido'}. ¿Quieres intentar con otra estación u horario?`,
          createdAt: new Date(),
          isStreaming: true,
        };
        setMessages((prev) => [...prev, errorMsg]);
        setStreamingMessageId(errorMsg.id);
      }
    },
    [createReservation]
  );

  const handleSendMessage = useCallback(
    async (text: string) => {
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
          context: userGpsLocation ? {
            currentLatitude: userGpsLocation.latitude,
            currentLongitude: userGpsLocation.longitude,
          } : undefined,
        });

        const assistantMsgId = Date.now() + 1;
        const assistantMessage: Message = {
          id: assistantMsgId,
          role: "assistant",
          content: response.content,
          createdAt: new Date(),
          isStreaming: true,
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setStreamingMessageId(assistantMsgId);
        refetchConversations();
      } catch (error: any) {
        toast.error(error.message || "Error al enviar mensaje");
      } finally {
        setIsLoading(false);
      }
    },
    [conversationId, isLoading, createConversation, sendMessageMutation, refetchConversations, userGpsLocation]
  );

  const handleStreamComplete = useCallback(() => {
    setStreamingMessageId(null);
    setMessages((prev) =>
      prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m))
    );
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(message);
    }
  };

  const handleNewChat = () => {
    setConversationId(null);
    setMessages([]);
    setStreamingMessageId(null);
  };

  const handleSelectConversation = (id: number) => {
    setConversationId(id);
    setShowHistory(false);
  };

  const lastAssistantMsgId = [...messages].reverse().find((m) => m.role === "assistant")?.id;

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
                  {isLoading ? "Pensando..." : streamingMessageId ? "Escribiendo..." : "En línea"}
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
        <div className="flex-1 overflow-y-auto p-6" ref={scrollRef}>
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
                  Soy tu asistente inteligente de EVGreen. Puedo ayudarte con:
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
                    isLatestAssistant={msg.id === lastAssistantMsgId}
                    onStreamComplete={handleStreamComplete}
                    onReservationConfirm={handleReservationConfirm}
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
                        <span className="text-sm text-muted-foreground">Pensando...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

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
