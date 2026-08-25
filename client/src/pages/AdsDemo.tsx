/**
 * EVGreen Ads Intelligence — Página de demostración pública
 * Muestra el flujo UX del AI Campaign Wizard con datos reales de audiencia
 * y gráficos interactivos de predicción de alcance.
 */

import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sparkles, Zap, Target, BarChart3, Users, Clock, TrendingUp,
  MapPin, Car, ChevronRight, Play, CheckCircle2, ArrowRight,
  Bot, Send, Loader2, Star, Shield, Globe, Activity, Radio,
  RotateCcw, SlidersHorizontal
} from "lucide-react";
import { VEHICLE_BRANDS } from "@shared/vehicle-brands";

// ─── Datos de demo ────────────────────────────────────────────────────────────

const DEMO_STEPS = [
  {
    step: 1,
    icon: "💬",
    title: "Describe tu objetivo",
    desc: "Habla con la IA en lenguaje natural. Sin formularios complejos.",
    color: "from-emerald-500/20 to-teal-500/20",
    border: "border-emerald-500/30",
  },
  {
    step: 2,
    icon: "🔍",
    title: "Análisis de audiencia real",
    desc: "La IA consulta datos reales de usuarios EVGreen para calcular tu alcance.",
    color: "from-blue-500/20 to-cyan-500/20",
    border: "border-blue-500/30",
  },
  {
    step: 3,
    icon: "🎯",
    title: "Plan de campaña generado",
    desc: "Segmentación óptima, presupuesto sugerido y predicción de resultados.",
    color: "from-purple-500/20 to-violet-500/20",
    border: "border-purple-500/30",
  },
  {
    step: 4,
    icon: "🚀",
    title: "Activación en 1 clic",
    desc: "La campaña se activa inmediatamente para la audiencia segmentada.",
    color: "from-amber-500/20 to-orange-500/20",
    border: "border-amber-500/30",
  },
];

const ADVANTAGES = [
  {
    icon: Clock,
    value: "22 min",
    label: "Dwell Time promedio",
    desc: "El usuario está cautivo mientras carga su vehículo",
    color: "text-amber-400",
    bg: "bg-amber-400/10",
  },
  {
    icon: Users,
    value: "100%",
    label: "Audiencia verificada",
    desc: "Propietarios reales de vehículos eléctricos registrados",
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
  },
  {
    icon: Target,
    value: "8 dims",
    label: "Dimensiones de segmentación",
    desc: "Ciudad, vehículo, comportamiento, suscripción y más",
    color: "text-blue-400",
    bg: "bg-blue-400/10",
  },
  {
    icon: BarChart3,
    value: "Real-time",
    label: "Analytics en vivo",
    desc: "Impresiones, clics, CTR y dwell time por campaña",
    color: "text-purple-400",
    bg: "bg-purple-400/10",
  },
];

const DEMO_CONVERSATION = [
  {
    role: "user",
    text: "Quiero anunciar mi concesionario BMW en Bogotá, busco clientes con vehículos de alta gama",
    delay: 0,
  },
  {
    role: "assistant",
    text: "Perfecto. Voy a analizar la audiencia de EVGreen para encontrar el segmento ideal para tu concesionario BMW en Bogotá...",
    delay: 1200,
    typing: true,
  },
  {
    role: "tool",
    text: "Consultando datos reales de audiencia...",
    delay: 2400,
  },
  {
    role: "assistant",
    text: "¡Excelente oportunidad! Encontré **847 usuarios** en Bogotá con vehículos BMW, Mercedes-Benz o Audi que han cargado más de 4 veces este mes. Tu campaña podría generar **1.200 impresiones diarias** con un dwell time promedio de **22 minutos**.",
    delay: 3800,
    stats: {
      reach: 847,
      dailyImpressions: 1200,
      dwellTime: 22,
      ctr: 4.2,
    },
  },
  {
    role: "assistant",
    text: "He generado el plan de campaña óptimo para tu concesionario. ¿Quieres activarlo ahora?",
    delay: 5200,
    plan: true,
  },
];

// ─── Animated counter ─────────────────────────────────────────────────────────

function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const duration = 1500;
          const steps = 60;
          const increment = value / steps;
          let current = 0;
          const timer = setInterval(() => {
            current += increment;
            if (current >= value) {
              setDisplay(value);
              clearInterval(timer);
            } else {
              setDisplay(Math.floor(current));
            }
          }, duration / steps);
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value]);

  return (
    <div ref={ref} className="tabular-nums">
      {display.toLocaleString("es-CO")}{suffix}
    </div>
  );
}

// ─── Interactive Demo Chat ────────────────────────────────────────────────────

function DemoChat() {
  const [visibleMessages, setVisibleMessages] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const playDemo = () => {
    if (isPlaying) return;
    setIsPlaying(true);
    setVisibleMessages(0);
    setIsComplete(false);

    DEMO_CONVERSATION.forEach((msg, i) => {
      setTimeout(() => {
        setVisibleMessages(i + 1);
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
        if (i === DEMO_CONVERSATION.length - 1) {
          setIsPlaying(false);
          setIsComplete(true);
        }
      }, msg.delay + 500);
    });
  };

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-900/80 overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700 bg-slate-800/60">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div>
          <div className="text-sm font-semibold text-white">EVGreen Ads Intelligence</div>
          <div className="text-xs text-slate-400">Consultor IA · Datos reales</div>
        </div>
        <Badge className="ml-auto bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 inline-block animate-pulse" />
          En línea
        </Badge>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="h-72 overflow-y-auto p-4 space-y-3 scroll-smooth">
        {visibleMessages === 0 && !isPlaying && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
              <Play className="w-6 h-6 text-emerald-400" />
            </div>
            <div className="text-sm text-slate-400">
              Haz clic en <strong className="text-white">"Ver demo"</strong> para ver el flujo completo
            </div>
          </div>
        )}

        {DEMO_CONVERSATION.slice(0, visibleMessages).map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            {msg.role !== "user" && (
              <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs ${
                msg.role === "tool"
                  ? "bg-amber-500/20 text-amber-400"
                  : "bg-gradient-to-br from-emerald-500 to-teal-600"
              }`}>
                {msg.role === "tool" ? <Zap className="w-3 h-3" /> : <Bot className="w-3 h-3 text-white" />}
              </div>
            )}
            <div className={`max-w-[80%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}>
              {msg.role === "tool" ? (
                <div className="text-xs text-amber-400/80 italic flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> {msg.text}
                </div>
              ) : (
                <div className={`rounded-xl px-3 py-2 text-sm ${
                  msg.role === "user"
                    ? "bg-emerald-600 text-white rounded-tr-sm"
                    : "bg-slate-800 text-slate-200 rounded-tl-sm"
                }`}>
                  {msg.text.split(/(\*\*[^*]+\*\*)/).map((part, j) =>
                    part.startsWith("**") ? <strong key={j} className="text-white">{part.slice(2, -2)}</strong> : part
                  )}
                </div>
              )}

              {/* Stats card */}
              {msg.stats && (
                <div className="grid grid-cols-2 gap-1.5 mt-1 w-full">
                  {[
                    { label: "Alcance", value: msg.stats.reach.toLocaleString("es-CO"), color: "text-emerald-400" },
                    { label: "Impresiones/día", value: msg.stats.dailyImpressions.toLocaleString("es-CO"), color: "text-blue-400" },
                    { label: "Dwell Time", value: `${msg.stats.dwellTime} min`, color: "text-amber-400" },
                    { label: "CTR estimado", value: `${msg.stats.ctr}%`, color: "text-purple-400" },
                  ].map((kpi, k) => (
                    <div key={k} className="bg-slate-800/80 rounded-lg p-2 text-center">
                      <div className={`text-base font-bold ${kpi.color}`}>{kpi.value}</div>
                      <div className="text-xs text-slate-500">{kpi.label}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Plan card */}
              {msg.plan && (
                <div className="mt-1 rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/60 to-slate-800/60 p-3 w-full">
                  <div className="text-xs font-semibold text-white mb-2">Plan generado: BMW Bogotá Premium</div>
                  <div className="space-y-1 text-xs text-slate-400">
                    <div className="flex justify-between"><span>Duración</span><span className="text-white">30 días</span></div>
                    <div className="flex justify-between"><span>Segmento</span><span className="text-white">BMW/Mercedes/Audi · Bogotá</span></div>
                    <div className="flex justify-between"><span>Inversión sugerida</span><span className="text-emerald-400">$2.400.000 COP</span></div>
                  </div>
                  <div className="mt-2 bg-emerald-600 rounded-lg py-1.5 text-center text-xs font-semibold text-white">
                    ✓ Activar campaña
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-slate-700 bg-slate-800/40">
        {isComplete ? (
          <Button
            onClick={playDemo}
            variant="outline"
            size="sm"
            className="w-full border-slate-600 text-slate-300 hover:text-white"
          >
            <Play className="w-3 h-3 mr-2" /> Repetir demo
          </Button>
        ) : (
          <Button
            onClick={playDemo}
            disabled={isPlaying}
            size="sm"
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            {isPlaying ? (
              <><Loader2 className="w-3 h-3 mr-2 animate-spin" /> Ejecutando demo...</>
            ) : (
              <><Play className="w-3 h-3 mr-2" /> Ver demo</>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Reach Predictor ─────────────────────────────────────────────────────────

function ReachPredictor() {
  const [selectedCities, setSelectedCities] = useState<string[]>(["Bogotá"]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedTier, setSelectedTier] = useState<string>("");
  const [minCharges, setMinCharges] = useState(0);

  const { data: prediction, isLoading } = trpc.campaignWizard.predictReach.useQuery(
    {
      segmentation: {
        targetCities: selectedCities.length > 0 ? selectedCities : undefined,
        targetVehicleBrands: selectedBrands.length > 0 ? selectedBrands : undefined,
        targetSubscriptionTiers: selectedTier ? [selectedTier] : undefined,
        targetMinChargesPerMonth: minCharges > 0 ? minCharges : undefined,
      },
    },
    { refetchOnWindowFocus: false }
  );

  const cities = ["Bogotá", "Medellín", "Cali", "Barranquilla", "Cartagena", "Bucaramanga"];
  const tiers = [
    { value: "", label: "Todos" },
    { value: "FREE", label: "Free" },
    { value: "BASIC", label: "Basic" },
    { value: "PREMIUM", label: "Premium" },
    { value: "ENTERPRISE", label: "Enterprise" },
  ];

  const toggleCity = (city: string) => {
    setSelectedCities(prev =>
      prev.includes(city) ? prev.filter(c => c !== city) : [...prev, city]
    );
  };

  const toggleBrand = (brand: string) => {
    setSelectedBrands(prev =>
      prev.includes(brand) ? prev.filter(b => b !== brand) : [...prev, brand]
    );
  };

  const reach = prediction?.estimatedReach ?? 0;
  const impressions = prediction?.estimatedDailyImpressions ?? 0;
  const dwell = prediction?.avgDwellTimeMinutes ?? 0;
  const totalUsers = prediction?.totalUsers ?? 1;
  const reachPct = totalUsers > 0 ? Math.round((reach / totalUsers) * 100) : 0;
  const activeFilterCount = selectedCities.length + selectedBrands.length + (selectedTier ? 1 : 0) + (minCharges > 0 ? 1 : 0);

  const resetFilters = () => {
    setSelectedCities(["Bogotá"]);
    setSelectedBrands([]);
    setSelectedTier("");
    setMinCharges(0);
  };

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-slate-700/80 bg-[#07101f] p-1 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
      <div className="pointer-events-none absolute inset-0 opacity-50 [background-image:linear-gradient(rgba(67,255,190,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(67,255,190,0.05)_1px,transparent_1px)] [background-size:28px_28px]" />
      <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 left-1/3 h-56 w-56 rounded-full bg-blue-500/10 blur-3xl" />

      <div className="relative rounded-[24px] border border-white/[0.06] bg-slate-950/70 p-4 sm:p-6">
        <header className="mb-5 flex flex-col gap-4 border-b border-white/[0.08] pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-400/10">
              <Target className="h-5 w-5 text-emerald-300" />
              <span className="absolute inset-1 rounded-xl border border-emerald-300/15" />
            </div>
            <div>
              <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300/80">
                <Radio className="h-3 w-3 animate-pulse" /> EVGreen Audience Intelligence
              </div>
              <h3 className="text-base font-semibold tracking-tight text-white sm:text-lg">Predictor de alcance en vivo</h3>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[0.08] px-3 py-1.5 text-xs font-medium text-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,1)]" />
              Datos en vivo
            </div>
            <button type="button" onClick={resetFilters} className="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-xs text-slate-400 transition-colors hover:bg-white/5 hover:text-white">
              <RotateCcw className="h-3.5 w-3.5" /> Reiniciar
            </button>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/[0.08] bg-slate-900/40 p-3.5 sm:p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-200"><MapPin className="h-3.5 w-3.5 text-emerald-300" /> Paso 01 · Geografía</div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">{selectedCities.length} mercados</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {cities.map((city) => {
                  const selected = selectedCities.includes(city);
                  return <button key={city} type="button" onClick={() => toggleCity(city)} className={`group inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${selected ? "border-emerald-300/50 bg-emerald-400/15 text-emerald-100 shadow-[0_0_20px_rgba(52,211,153,0.12)]" : "border-slate-700 bg-slate-900/80 text-slate-400 hover:border-slate-500 hover:text-slate-100"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${selected ? "bg-emerald-300" : "bg-slate-600 group-hover:bg-slate-400"}`} />{city}
                  </button>;
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-slate-900/40 p-3.5 sm:p-4">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-200"><Car className="h-3.5 w-3.5 text-blue-300" /> Paso 02 · Perfil del vehículo <span className="text-slate-500">(opcional)</span></div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">{selectedBrands.length ? `${selectedBrands.length} marcas activas` : "todas las marcas"}</span>
              </div>
              <div className="grid max-h-40 grid-cols-2 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-3">
                {VEHICLE_BRANDS.map((brand) => {
                  const selected = selectedBrands.includes(brand);
                  return <button key={brand} type="button" onClick={() => toggleBrand(brand)} className={`flex items-center justify-between rounded-lg border px-2.5 py-2 text-left text-xs transition-all ${selected ? "border-blue-300/40 bg-blue-500/15 text-blue-100" : "border-slate-800 bg-slate-950/50 text-slate-400 hover:border-slate-600 hover:text-slate-100"}`}>
                    <span className="truncate">{brand}</span>
                    {selected && <CheckCircle2 className="ml-1 h-3.5 w-3.5 shrink-0 text-blue-300" />}
                  </button>;
                })}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/[0.08] bg-slate-900/40 p-3.5 sm:p-4">
                <div className="mb-3 flex items-center gap-2 text-xs font-medium text-slate-200"><SlidersHorizontal className="h-3.5 w-3.5 text-fuchsia-300" /> Paso 03 · Suscripción</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {tiers.map((tier) => <button key={tier.value || "all"} type="button" onClick={() => setSelectedTier(tier.value)} className={`rounded-lg border px-2 py-2 text-xs font-medium transition-all ${selectedTier === tier.value ? "border-fuchsia-300/50 bg-fuchsia-500/20 text-fuchsia-100" : "border-slate-800 bg-slate-950/50 text-slate-400 hover:border-slate-600 hover:text-slate-100"}`}>{tier.label}</button>)}
                </div>
              </div>
              <div className="rounded-2xl border border-white/[0.08] bg-slate-900/40 p-3.5 sm:p-4">
                <div className="mb-3 flex items-center gap-2 text-xs font-medium text-slate-200"><Activity className="h-3.5 w-3.5 text-amber-300" /> Paso 04 · Actividad mensual</div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[0, 2, 4, 8].map((charges) => <button key={charges} type="button" onClick={() => setMinCharges(charges)} className={`rounded-lg border px-1 py-2 text-xs font-medium transition-all ${minCharges === charges ? "border-amber-300/50 bg-amber-400/20 text-amber-100" : "border-slate-800 bg-slate-950/50 text-slate-400 hover:border-slate-600 hover:text-slate-100"}`}>{charges === 0 ? "Todas" : `${charges}+`}</button>)}
                </div>
              </div>
            </div>
          </div>

          <aside className="relative overflow-hidden rounded-2xl border border-emerald-400/20 bg-gradient-to-b from-emerald-950/40 via-slate-900/90 to-slate-950 p-4 sm:p-5">
            <div className="pointer-events-none absolute -right-8 top-10 h-28 w-28 rounded-full border border-emerald-300/15" />
            <div className="pointer-events-none absolute -right-3 top-16 h-[4.5rem] w-[4.5rem] rounded-full border border-emerald-300/10" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200/70">Proyección de audiencia</p>
                <span className="rounded-md border border-white/10 bg-white/5 px-1.5 py-1 font-mono text-[10px] text-slate-400">{activeFilterCount.toString().padStart(2, "0")} filtros</span>
              </div>

              {isLoading ? (
                <div className="flex min-h-56 flex-col items-center justify-center gap-3 text-center text-slate-400"><Loader2 className="h-7 w-7 animate-spin text-emerald-300" /><p className="text-sm">Procesando señal de audiencia…</p></div>
              ) : (
                <div className="mt-6 space-y-5">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">Alcance estimado</p>
                    <p className="mt-1 text-4xl font-bold tracking-tight text-emerald-300 sm:text-5xl">{reach.toLocaleString("es-CO")}</p>
                    <p className="mt-1 text-xs text-emerald-100/60">conductores alcanzables</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 border-y border-white/[0.08] py-4">
                    <div><p className="font-mono text-[10px] uppercase tracking-wide text-slate-500">Impresiones/día</p><p className="mt-1 text-xl font-semibold text-blue-300">{impressions.toLocaleString("es-CO")}</p></div>
                    <div className="border-l border-white/[0.08] pl-3"><p className="font-mono text-[10px] uppercase tracking-wide text-slate-500">Dwell time</p><p className="mt-1 text-xl font-semibold text-amber-300">{dwell}<span className="ml-0.5 text-xs">min</span></p></div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between text-xs"><span className="text-slate-400">Cobertura del segmento</span><span className="font-mono font-semibold text-white">{reachPct}%</span></div>
                    <div className="relative h-2.5 overflow-hidden rounded-full bg-slate-800"><div className="absolute inset-0 opacity-40 [background-image:repeating-linear-gradient(90deg,transparent_0,transparent_9%,rgba(255,255,255,0.25)_10%)]" /><div className="relative h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-300 shadow-[0_0_18px_rgba(45,212,191,0.75)] transition-all duration-700" style={{ width: `${Math.min(reachPct, 100)}%` }} /></div>
                  </div>

                  <p className="rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2.5 text-center text-xs leading-5 text-slate-400">{reach > 0 ? `Señal activa: tu campaña cubriría el ${reachPct}% del segmento configurado.` : "Ajusta los filtros para calcular una señal de audiencia."}</p>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdsDemo() {
  return (
    <div className="min-h-screen bg-[#030712] text-white">
      {/* Hero */}
      <div className="relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/40 via-transparent to-blue-950/30 pointer-events-none" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-4 pt-16 pb-12">
          {/* Nav */}
          <div className="flex items-center justify-between mb-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-lg">EVGreen</span>
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs ml-1">
                Ads
              </Badge>
            </div>
            <a
              href="/"
              className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-1"
            >
              Ir a la plataforma <ChevronRight className="w-4 h-4" />
            </a>
          </div>

          {/* Hero content */}
          <div className="text-center max-w-3xl mx-auto">
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 mb-6 px-4 py-1.5">
              <Sparkles className="w-3.5 h-3.5 mr-2" />
              EVGreen Ads Intelligence · IA + Datos reales
            </Badge>

            <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
              Publicidad que llega cuando{" "}
              <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                el usuario está presente
              </span>
            </h1>

            <p className="text-lg text-slate-400 mb-8 leading-relaxed">
              Mientras tu cliente carga su vehículo eléctrico, tiene <strong className="text-white">22 minutos</strong> de
              atención cautiva. Nuestra IA diseña la campaña perfecta con datos reales de audiencia
              y la activa en segundos.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                size="lg"
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-8"
                onClick={() => document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" })}
              >
                <Play className="w-4 h-4 mr-2" /> Ver demo interactivo
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-slate-600 text-slate-300 hover:text-white hover:border-slate-400"
                onClick={() => document.getElementById("predictor")?.scrollIntoView({ behavior: "smooth" })}
              >
                <Target className="w-4 h-4 mr-2" /> Calcular mi alcance
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Advantages */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {ADVANTAGES.map((adv, i) => (
            <div key={i} className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 text-center">
              <div className={`w-10 h-10 rounded-xl ${adv.bg} flex items-center justify-center mx-auto mb-3`}>
                <adv.icon className={`w-5 h-5 ${adv.color}`} />
              </div>
              <div className={`text-2xl font-bold ${adv.color} mb-1`}>
                <AnimatedNumber
                  value={typeof adv.value === "string" && adv.value.includes("%")
                    ? parseInt(adv.value)
                    : typeof adv.value === "string" && adv.value.includes("min")
                    ? parseInt(adv.value)
                    : typeof adv.value === "string" && adv.value.includes("dims")
                    ? parseInt(adv.value)
                    : 0}
                  suffix={
                    typeof adv.value === "string" && adv.value.includes("%") ? "%" :
                    typeof adv.value === "string" && adv.value.includes("min") ? " min" :
                    typeof adv.value === "string" && adv.value.includes("dims") ? " dims" : ""
                  }
                />
                {adv.value === "100%" ? "100%" : adv.value === "Real-time" ? "Real-time" : ""}
              </div>
              <div className="text-sm font-medium text-white mb-1">{adv.label}</div>
              <div className="text-xs text-slate-500">{adv.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">
            De la idea a la campaña en{" "}
            <span className="text-emerald-400">menos de 2 minutos</span>
          </h2>
          <p className="text-slate-400">Sin formularios complejos. Sin agencias. Sin esperas.</p>
        </div>

        <div className="grid md:grid-cols-4 gap-4">
          {DEMO_STEPS.map((step, i) => (
            <div key={i} className={`rounded-xl border ${step.border} bg-gradient-to-br ${step.color} p-5`}>
              <div className="text-3xl mb-3">{step.icon}</div>
              <div className="text-xs font-medium text-slate-400 mb-1">Paso {step.step}</div>
              <div className="font-semibold text-white mb-2">{step.title}</div>
              <div className="text-sm text-slate-400">{step.desc}</div>
              {i < DEMO_STEPS.length - 1 && (
                <ArrowRight className="w-4 h-4 text-slate-600 mt-3 hidden md:block" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Demo + Predictor */}
      <div id="demo" className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">Demo interactivo</h2>
          <p className="text-slate-400">Ve el flujo completo del AI Campaign Wizard en acción</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <DemoChat />

          <div className="space-y-4">
            <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-5">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-400" />
                ¿Por qué EVGreen Ads?
              </h3>
              <div className="space-y-3">
                {[
                  { icon: Clock, text: "22 minutos de exposición vs 3 segundos en redes sociales", color: "text-amber-400" },
                  { icon: Shield, text: "Audiencia 100% verificada — propietarios reales de EVs", color: "text-emerald-400" },
                  { icon: Target, text: "8 dimensiones de segmentación con datos reales de comportamiento", color: "text-blue-400" },
                  { icon: BarChart3, text: "Reportes de campaña exportables para presentar a tu equipo", color: "text-purple-400" },
                  { icon: Globe, text: "Presencia en todas las estaciones de carga de la red EVGreen", color: "text-teal-400" },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <item.icon className={`w-4 h-4 ${item.color} flex-shrink-0 mt-0.5`} />
                    <span className="text-sm text-slate-300">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                <span className="text-sm font-medium text-white">Ventaja única vs. medios tradicionales</span>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                Mientras un usuario espera que cargue su vehículo, tiene el teléfono en la mano
                y tiempo libre. <strong className="text-white">Ningún otro medio puede garantizar 22 minutos
                de atención activa</strong> de un propietario de EV con alto poder adquisitivo.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Reach Predictor */}
      <div id="predictor" className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">
            Calcula tu alcance{" "}
            <span className="text-emerald-400">en tiempo real</span>
          </h2>
          <p className="text-slate-400">
            Selecciona tu audiencia objetivo y ve cuántos usuarios reales puedes alcanzar
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          <ReachPredictor />
        </div>
      </div>

      {/* CTA */}
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/40 to-slate-900/60 p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-500/20">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold mb-3">
            ¿Listo para crear tu primera campaña?
          </h2>
          <p className="text-slate-400 mb-7 max-w-xl mx-auto">
            Regístrate como anunciante y usa el AI Campaign Wizard para diseñar
            y activar tu campaña en menos de 2 minutos.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href="/advertiser/campaigns/new">
              <Button size="lg" className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-8">
                <Sparkles className="w-4 h-4 mr-2" /> Crear campaña con IA
              </Button>
            </a>
            <a href="/advertiser/dashboard">
              <Button size="lg" variant="outline" className="border-slate-600 text-slate-300 hover:text-white">
                Ver la plataforma
              </Button>
            </a>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-800 py-6 text-center text-xs text-slate-600">
        EVGreen Ads Intelligence · Powered by Green House Project · {new Date().getFullYear()}
      </div>
    </div>
  );
}
