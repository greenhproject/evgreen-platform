/**
 * AI Campaign Wizard
 * Asistente inteligente para crear campañas publicitarias con IA y function calling.
 * Integrado en el panel admin de EVGreen.
 */

import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sparkles,
  Send,
  Bot,
  User,
  Zap,
  Target,
  BarChart3,
  CheckCircle2,
  ArrowRight,
  Loader2,
  MapPin,
  Car,
  Users,
  Clock,
  TrendingUp,
  X,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  role: "user" | "assistant";
  content: string;
  toolCalled?: string | null;
  audienceStats?: AudienceStats | null;
  campaignPlan?: CampaignPlan | null;
}

interface AudienceStats {
  totalUsers: number;
  estimatedReach: number;
  avgDwellTimeMinutes: number;
  estimatedDailyImpressions: number;
  estimatedCTR: number;
  topCities: Array<{ city: string; count: number }>;
  topVehicleBrands: Array<{ brand: string; count: number }>;
  subscriptionBreakdown: Array<{ tier: string; count: number }>;
  peakHours: number[];
  segmentDescription: string;
}

interface CampaignPlan {
  title: string;
  description: string;
  ctaText: string;
  ctaUrl?: string;
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
  recommendedDurationDays: number;
  recommendedBudgetCOP?: number;
  segmentation: Record<string, unknown>;
  audienceStats: {
    estimatedReach: number;
    estimatedDailyImpressions: number;
    estimatedCTR: number;
    avgDwellTimeMinutes: number;
  };
  rationale: string;
}

// ─── Audience Stats Card ──────────────────────────────────────────────────────

function AudienceStatsCard({ stats }: { stats: AudienceStats }) {
  const maxCity = Math.max(...stats.topCities.map(c => c.count), 1);
  const maxBrand = Math.max(...stats.topVehicleBrands.map(b => b.count), 1);

  return (
    <div className="mt-3 rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/40 to-slate-900/60 p-4 space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-slate-800/60 p-3 text-center">
          <div className="text-2xl font-bold text-emerald-400">
            {stats.estimatedReach.toLocaleString("es-CO")}
          </div>
          <div className="text-xs text-slate-400 mt-0.5 flex items-center justify-center gap-1">
            <Users className="w-3 h-3" /> Alcance estimado
          </div>
        </div>
        <div className="rounded-lg bg-slate-800/60 p-3 text-center">
          <div className="text-2xl font-bold text-blue-400">
            {stats.estimatedDailyImpressions.toLocaleString("es-CO")}
          </div>
          <div className="text-xs text-slate-400 mt-0.5 flex items-center justify-center gap-1">
            <BarChart3 className="w-3 h-3" /> Impresiones/día
          </div>
        </div>
        <div className="rounded-lg bg-slate-800/60 p-3 text-center">
          <div className="text-2xl font-bold text-amber-400">
            {stats.avgDwellTimeMinutes}min
          </div>
          <div className="text-xs text-slate-400 mt-0.5 flex items-center justify-center gap-1">
            <Clock className="w-3 h-3" /> Dwell Time prom.
          </div>
        </div>
        <div className="rounded-lg bg-slate-800/60 p-3 text-center">
          <div className="text-2xl font-bold text-purple-400">
            {stats.estimatedCTR}%
          </div>
          <div className="text-xs text-slate-400 mt-0.5 flex items-center justify-center gap-1">
            <TrendingUp className="w-3 h-3" /> CTR estimado
          </div>
        </div>
      </div>

      {/* Top ciudades */}
      {stats.topCities.length > 0 && (
        <div>
          <div className="text-xs font-medium text-slate-300 mb-2 flex items-center gap-1">
            <MapPin className="w-3 h-3 text-emerald-400" /> Top ciudades
          </div>
          <div className="space-y-1.5">
            {stats.topCities.slice(0, 4).map(c => (
              <div key={c.city} className="flex items-center gap-2">
                <span className="text-xs text-slate-400 w-20 truncate">{c.city}</span>
                <div className="flex-1 bg-slate-700 rounded-full h-1.5">
                  <div
                    className="bg-emerald-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${(c.count / maxCity) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-slate-400 w-8 text-right">{c.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top marcas */}
      {stats.topVehicleBrands.length > 0 && (
        <div>
          <div className="text-xs font-medium text-slate-300 mb-2 flex items-center gap-1">
            <Car className="w-3 h-3 text-blue-400" /> Top marcas de vehículo
          </div>
          <div className="flex flex-wrap gap-1.5">
            {stats.topVehicleBrands.slice(0, 6).map(b => (
              <Badge key={b.brand} variant="secondary" className="text-xs bg-slate-700 text-slate-300">
                {b.brand} <span className="ml-1 text-blue-400">{b.count}</span>
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="text-xs text-slate-500 italic">{stats.segmentDescription}</div>
    </div>
  );
}

// ─── Campaign Plan Card ───────────────────────────────────────────────────────

function CampaignPlanCard({
  plan,
  onActivate,
  isActivating,
}: {
  plan: CampaignPlan;
  onActivate: (plan: CampaignPlan) => void;
  isActivating: boolean;
}) {
  const bg = plan.backgroundColor || "#0f172a";
  const text = plan.textColor || "#ffffff";
  const accent = plan.accentColor || "#10b981";

  return (
    <div className="mt-3 space-y-3">
      {/* Banner preview */}
      <div className="text-xs font-medium text-slate-300 mb-1">Vista previa del banner:</div>
      <div
        className="rounded-xl p-4 flex flex-col gap-2 shadow-lg"
        style={{ backgroundColor: bg, color: text }}
      >
        <div className="font-bold text-base leading-tight">{plan.title}</div>
        <div className="text-sm opacity-80">{plan.description}</div>
        {plan.ctaText && (
          <div
            className="self-start rounded-lg px-3 py-1.5 text-xs font-semibold mt-1"
            style={{ backgroundColor: accent, color: "#fff" }}
          >
            {plan.ctaText} →
          </div>
        )}
      </div>

      {/* Plan details */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs text-slate-400">Duración recomendada</div>
            <div className="font-semibold text-white">{plan.recommendedDurationDays} días</div>
          </div>
          {plan.recommendedBudgetCOP && (
            <div>
              <div className="text-xs text-slate-400">Inversión sugerida</div>
              <div className="font-semibold text-emerald-400">
                ${plan.recommendedBudgetCOP.toLocaleString("es-CO")} COP
              </div>
            </div>
          )}
          <div>
            <div className="text-xs text-slate-400">Alcance estimado</div>
            <div className="font-semibold text-blue-400">
              {plan.audienceStats.estimatedReach.toLocaleString("es-CO")} usuarios
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Impresiones/día</div>
            <div className="font-semibold text-purple-400">
              {plan.audienceStats.estimatedDailyImpressions.toLocaleString("es-CO")}
            </div>
          </div>
        </div>

        <div className="text-xs text-slate-400 border-t border-slate-700 pt-3">
          <span className="font-medium text-slate-300">Justificación: </span>
          {plan.rationale}
        </div>

        <Button
          onClick={() => onActivate(plan)}
          disabled={isActivating}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
        >
          {isActivating ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creando campaña...</>
          ) : (
            <><CheckCircle2 className="w-4 h-4 mr-2" /> Activar esta campaña</>
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface CampaignWizardProps {
  open: boolean;
  onClose: () => void;
  onCampaignCreated?: () => void;
}

export function CampaignWizard({ open, onClose, onCampaignCreated }: CampaignWizardProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const chatMutation = trpc.campaignWizard.chat.useMutation();
  const createBannerMutation = trpc.banners.create.useMutation();
  const utils = trpc.useUtils();

  // Mensaje de bienvenida al abrir
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        role: "assistant",
        content: "¡Hola! Soy **EVGreen Ads Intelligence** 🤖⚡\n\nSoy tu consultor de medios especializado en publicidad para la red de carga de vehículos eléctricos más innovadora de Colombia.\n\nTengo acceso a datos reales de nuestra audiencia — propietarios de EVs con **22 minutos promedio de exposición** mientras cargan su vehículo.\n\n¿Cuál es el **objetivo principal** de tu campaña? (Por ejemplo: generar visitas a tu tienda, dar a conocer una nueva marca, captar leads, etc.)",
      }]);
    }
  }, [open]);

  // Auto-scroll al último mensaje
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      // Convertir mensajes al formato del backend (solo role + content)
      const backendMessages = newMessages.map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      const result = await chatMutation.mutateAsync({ messages: backendMessages });

      const assistantMessage: Message = {
        role: "assistant",
        content: typeof result.message === "string" ? result.message : String(result.message),
        toolCalled: result.toolCalled,
        audienceStats: result.toolCalled === "getAudienceStats" ? (result.toolResult as AudienceStats) : null,
        campaignPlan: result.campaignPlan as CampaignPlan | null,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      toast.error("Error al comunicarse con la IA. Intenta de nuevo.");
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleActivateCampaign = async (plan: CampaignPlan) => {
    setIsActivating(true);
    try {
      const seg = plan.segmentation as any;
      await createBannerMutation.mutateAsync({
        title: plan.title,
        description: plan.description,
        ctaText: plan.ctaText,
        linkUrl: plan.ctaUrl,
        imageUrl: "https://placehold.co/1080x600/0f172a/10b981?text=EVGreen+Ads",
        type: "CHARGING",
        targetCities: seg.targetCities,
        targetDepartments: seg.targetDepartments,
        targetVehicleBrands: seg.targetVehicleBrands,
        targetVehicleModels: seg.targetVehicleModels,
        targetConnectorTypes: seg.targetConnectorTypes,
        targetMinChargesPerMonth: seg.targetMinChargesPerMonth,
        targetSubscriptionTiers: seg.targetSubscriptionTiers,
        targetActivitySegments: seg.targetActivitySegments,
      });

      await utils.banners.list.invalidate();
      toast.success("¡Campaña creada y activada exitosamente! 🎉");
      onCampaignCreated?.();
      onClose();
    } catch (error) {
      toast.error("Error al crear la campaña. Intenta de nuevo.");
    } finally {
      setIsActivating(false);
    }
  };

  const handleReset = () => {
    setMessages([]);
    setInput("");
  };

  const quickPrompts = [
    "Quiero anunciar mi concesionario en Bogotá",
    "Tengo un restaurante cerca de una estación de carga",
    "Sorpréndeme — diseña la campaña perfecta",
    "Quiero llegar a usuarios premium con Tesla o BMW",
  ];

  const renderMessageContent = (content: string) => {
    // Simple markdown: **bold**, \n -> line breaks
    const parts = content.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
      }
      return <span key={i}>{part.split("\n").map((line, j) => (
        <span key={j}>{line}{j < part.split("\n").length - 1 && <br />}</span>
      ))}</span>;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl h-[85vh] flex flex-col p-0 bg-slate-900 border-slate-700 gap-0">
        {/* Header */}
        <DialogHeader className="px-5 py-4 border-b border-slate-700/60 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-white text-base font-semibold">
                  EVGreen Ads Intelligence
                </DialogTitle>
                <p className="text-xs text-slate-400">Consultor IA · Datos reales de audiencia</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 inline-block animate-pulse" />
                En línea
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="text-slate-400 hover:text-white h-8 w-8 p-0"
                title="Nueva conversación"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Messages */}
        <ScrollArea className="flex-1 px-5 py-4" ref={scrollRef as any}>
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                {/* Avatar */}
                <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${
                  msg.role === "assistant"
                    ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white"
                    : "bg-slate-600 text-slate-300"
                }`}>
                  {msg.role === "assistant" ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </div>

                {/* Bubble */}
                <div className={`max-w-[80%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col`}>
                  <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-emerald-600 text-white rounded-tr-sm"
                      : "bg-slate-800 text-slate-200 rounded-tl-sm"
                  }`}>
                    {renderMessageContent(msg.content)}
                  </div>

                  {/* Audience stats card */}
                  {msg.audienceStats && (
                    <AudienceStatsCard stats={msg.audienceStats} />
                  )}

                  {/* Campaign plan card */}
                  {msg.campaignPlan && (
                    <CampaignPlanCard
                      plan={msg.campaignPlan}
                      onActivate={handleActivateCampaign}
                      isActivating={isActivating}
                    />
                  )}

                  {/* Tool indicator */}
                  {msg.toolCalled && (
                    <div className="mt-1.5 flex items-center gap-1 text-xs text-slate-500">
                      <Zap className="w-3 h-3 text-amber-400" />
                      {msg.toolCalled === "getAudienceStats" ? "Consultó datos reales de audiencia" : "Generó plan de campaña"}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-slate-400">Analizando audiencia...</span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Quick prompts (solo al inicio) */}
        {messages.length <= 1 && !isLoading && (
          <div className="px-5 pb-2 flex-shrink-0">
            <div className="text-xs text-slate-500 mb-2">Sugerencias rápidas:</div>
            <div className="grid grid-cols-2 gap-1.5">
              {quickPrompts.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => { setInput(prompt); setTimeout(() => inputRef.current?.focus(), 50); }}
                  className="text-left text-xs text-slate-400 hover:text-emerald-400 bg-slate-800/60 hover:bg-slate-800 border border-slate-700 hover:border-emerald-500/40 rounded-lg px-3 py-2 transition-all"
                >
                  <ArrowRight className="w-3 h-3 inline mr-1 text-emerald-500" />
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="px-5 py-4 border-t border-slate-700/60 flex-shrink-0">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder="Describe tu objetivo publicitario..."
              disabled={isLoading}
              className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 focus:border-emerald-500 h-10"
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="bg-emerald-600 hover:bg-emerald-500 text-white h-10 w-10 p-0 flex-shrink-0"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <Target className="w-3 h-3 text-slate-500" />
            <span className="text-xs text-slate-500">
              La IA consulta datos reales de audiencia para optimizar tu campaña
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
