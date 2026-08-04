import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { AdvertiserLayout } from "@/components/AdvertiserLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  Sparkles, ArrowRight, ArrowLeft, CheckCircle, Target,
  DollarSign, MapPin, Car, Users, Lightbulb, Loader2,
} from "lucide-react";

const CITIES = ["Bogotá", "Medellín", "Cali", "Barranquilla", "Cartagena", "Bucaramanga", "Pereira", "Manizales", "Cúcuta", "Ibagué"];
const BRANDS = ["Tesla", "BYD", "Renault Zoe", "Chevrolet Bolt", "Hyundai Ioniq", "Kia EV6", "Volvo", "BMW", "Audi", "Porsche", "JAC", "MG"];
const OBJECTIVES = [
  { value: "awareness", label: "Reconocimiento de marca", desc: "Llega a la mayor cantidad de conductores" },
  { value: "traffic", label: "Tráfico a tu sitio web", desc: "Genera visitas a tu página" },
  { value: "conversions", label: "Conversiones", desc: "Impulsa acciones específicas" },
  { value: "app_install", label: "Instalación de app", desc: "Aumenta las descargas de tu app" },
];

type Step = "objective" | "targeting" | "ai" | "budget" | "review";

interface FormData {
  name: string;
  objective: string;
  targetCities: string[];
  targetVehicleBrands: string[];
  targetSubscriptionTiers: string[];
  targetMinChargesPerMonth: string;
  budgetTotal: string;
  startDate: string;
  endDate: string;
  // AI suggestions
  aiCopyTitle: string;
  aiCopySubtitle: string;
  aiCopyBody: string;
  aiCtaText: string;
  targetDescription: string;
}

export default function NewCampaign() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("objective");
  const [form, setForm] = useState<FormData>({
    name: "",
    objective: "awareness",
    targetCities: [],
    targetVehicleBrands: [],
    targetSubscriptionTiers: [],
    targetMinChargesPerMonth: "",
    budgetTotal: "",
    startDate: "",
    endDate: "",
    aiCopyTitle: "",
    aiCopySubtitle: "",
    aiCopyBody: "",
    aiCtaText: "",
    targetDescription: "",
  });
  const [aiSuggestions, setAiSuggestions] = useState<any>(null);

  const { data: profile } = trpc.advertiser.getProfile.useQuery(undefined, {
    enabled: !!user, retry: false,
  });

  const aiMutation = trpc.advertiser.getAiSuggestions.useMutation({
    onSuccess: (data) => {
      setAiSuggestions(data);
      setForm((f) => ({
        ...f,
        name: f.name || data.campaignName,
        targetCities: data.targetCities,
        targetVehicleBrands: data.targetVehicleBrands,
        targetActivitySegments: data.targetActivitySegments,
        budgetTotal: f.budgetTotal || String(data.suggestedBudget),
        aiCopyTitle: data.copyTitle,
        aiCopySubtitle: data.copySubtitle,
        aiCopyBody: data.copyBody,
        aiCtaText: data.ctaText,
      }));
    },
    onError: (err) => toast({ title: "Error IA", description: err.message, variant: "destructive" }),
  });

  const createMutation = trpc.advertiser.createCampaign.useMutation({
    onSuccess: (data) => {
      toast({ title: "¡Campaña creada!", description: "Ahora agrega tus creatividades." });
      navigate(`/advertiser/campaigns/${data.campaignId}`);
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const toggleItem = (arr: string[], item: string): string[] =>
    arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];

  const handleCreate = () => {
    if (!form.name.trim()) {
      toast({ title: "Error", description: "El nombre de la campaña es requerido.", variant: "destructive" });
      return;
    }
    if (!form.budgetTotal || parseInt(form.budgetTotal) < 1) {
      toast({ title: "Error", description: "El presupuesto debe ser mayor a 0.", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      name: form.name,
      objective: form.objective as any,
      budgetTotal: parseInt(form.budgetTotal),
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      targetCities: form.targetCities.length > 0 ? form.targetCities : undefined,
      targetVehicleBrands: form.targetVehicleBrands.length > 0 ? form.targetVehicleBrands : undefined,
      targetSubscriptionTiers: form.targetSubscriptionTiers.length > 0 ? form.targetSubscriptionTiers : undefined,
      targetMinChargesPerMonth: form.targetMinChargesPerMonth ? parseInt(form.targetMinChargesPerMonth) : undefined,
    });
  };

  const steps: Step[] = ["objective", "targeting", "ai", "budget", "review"];
  const stepIndex = steps.indexOf(step);

  return (
    <AdvertiserLayout title="Nueva Campaña">
      {/* Progress bar */}
      <div className="flex items-center gap-2 mb-8">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                i < stepIndex ? "bg-green-500 text-white" :
                i === stepIndex ? "bg-green-500/20 border border-green-500 text-green-400" :
                "bg-white/5 text-white/30"
              }`}
            >
              {i < stepIndex ? <CheckCircle className="w-4 h-4" /> : i + 1}
            </div>
            {i < steps.length - 1 && (
              <div className={`h-px w-8 transition-all ${i < stepIndex ? "bg-green-500" : "bg-white/10"}`} />
            )}
          </div>
        ))}
        <span className="ml-2 text-white/40 text-sm capitalize">{
          { objective: "Objetivo", targeting: "Audiencia", ai: "IA", budget: "Presupuesto", review: "Revisión" }[step]
        }</span>
      </div>

      <div className="max-w-2xl">
        {/* Step 1: Objective */}
        {step === "objective" && (
          <div>
            <h2 className="text-white text-lg font-semibold mb-1">¿Cuál es el objetivo de tu campaña?</h2>
            <p className="text-white/50 text-sm mb-6">Elige el objetivo principal para optimizar la distribución de tus anuncios.</p>
            <div className="grid grid-cols-1 gap-3 mb-6">
              {OBJECTIVES.map((obj) => (
                <button
                  key={obj.value}
                  onClick={() => setForm({ ...form, objective: obj.value })}
                  className={`text-left p-4 rounded-xl border transition-all ${
                    form.objective === obj.value
                      ? "border-green-500 bg-green-500/10"
                      : "border-white/10 bg-[#0d1526] hover:border-white/20"
                  }`}
                >
                  <p className={`font-medium text-sm ${form.objective === obj.value ? "text-green-400" : "text-white"}`}>
                    {obj.label}
                  </p>
                  <p className="text-white/40 text-xs mt-0.5">{obj.desc}</p>
                </button>
              ))}
            </div>
            <div className="mb-6">
              <Label className="text-white/70 text-sm">Nombre de la campaña</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: Campaña Verano 2026"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 mt-1"
              />
            </div>
            <Button
              className="bg-green-500 hover:bg-green-600 text-white"
              onClick={() => setStep("targeting")}
            >
              Continuar <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {/* Step 2: Targeting */}
        {step === "targeting" && (
          <div>
            <h2 className="text-white text-lg font-semibold mb-1">Define tu audiencia</h2>
            <p className="text-white/50 text-sm mb-6">Selecciona las ciudades y marcas de vehículos que quieres alcanzar.</p>

            <div className="mb-5">
              <Label className="text-white/70 text-sm mb-2 block">Ciudades objetivo</Label>
              <div className="flex flex-wrap gap-2">
                {CITIES.map((city) => (
                  <button
                    key={city}
                    onClick={() => setForm({ ...form, targetCities: toggleItem(form.targetCities, city) })}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                      form.targetCities.includes(city)
                        ? "bg-green-500/20 border border-green-500/40 text-green-400"
                        : "bg-white/5 border border-white/10 text-white/50 hover:border-white/20"
                    }`}
                  >
                    {city}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <Label className="text-white/70 text-sm mb-2 block">Marcas de vehículos</Label>
              <div className="flex flex-wrap gap-2">
                {BRANDS.map((brand) => (
                  <button
                    key={brand}
                    onClick={() => setForm({ ...form, targetVehicleBrands: toggleItem(form.targetVehicleBrands, brand) })}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                      form.targetVehicleBrands.includes(brand)
                        ? "bg-blue-500/20 border border-blue-500/40 text-blue-400"
                        : "bg-white/5 border border-white/10 text-white/50 hover:border-white/20"
                    }`}
                  >
                    {brand}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <Label className="text-white/70 text-sm">Mínimo de cargas por mes</Label>
              <Input
                type="number"
                value={form.targetMinChargesPerMonth}
                onChange={(e) => setForm({ ...form, targetMinChargesPerMonth: e.target.value })}
                placeholder="Ej: 4 (usuarios que cargan al menos 4 veces al mes)"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 mt-1"
              />
            </div>

            <div className="mb-6">
              <Label className="text-white/70 text-sm">Describe tu audiencia ideal (para la IA)</Label>
              <Textarea
                value={form.targetDescription}
                onChange={(e) => setForm({ ...form, targetDescription: e.target.value })}
                placeholder="Ej: Profesionales de 30-45 años con vehículos premium que cargan frecuentemente en Bogotá..."
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 mt-1 resize-none"
                rows={3}
              />
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="border-white/10 text-white/60 hover:bg-white/5" onClick={() => setStep("objective")}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Atrás
              </Button>
              <Button className="bg-green-500 hover:bg-green-600 text-white" onClick={() => setStep("ai")}>
                Continuar <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: AI Wizard */}
        {step === "ai" && (
          <div>
            <h2 className="text-white text-lg font-semibold mb-1">AI Campaign Wizard</h2>
            <p className="text-white/50 text-sm mb-6">
              Deja que la IA genere sugerencias de copy y estrategia para tu campaña basadas en tu audiencia.
            </p>

            {!aiSuggestions ? (
              <div className="bg-[#0d1526] border border-white/5 rounded-xl p-8 text-center mb-6">
                <div className="w-14 h-14 rounded-2xl bg-green-500/15 flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-7 h-7 text-green-400" />
                </div>
                <p className="text-white font-medium mb-2">Genera sugerencias con IA</p>
                <p className="text-white/40 text-sm mb-5">
                  Basado en tu objetivo ({OBJECTIVES.find(o => o.value === form.objective)?.label}),
                  industria y audiencia, la IA creará copy y estrategia optimizada.
                </p>
                <Button
                  className="bg-green-500 hover:bg-green-600 text-white"
                  onClick={() =>
                    aiMutation.mutate({
                      objective: form.objective,
                      industry: profile?.industry ?? undefined,
                      monthlyBudget: form.budgetTotal ? parseInt(form.budgetTotal) : profile?.monthlyBudget ?? undefined,
                      targetDescription: form.targetDescription || undefined,
                    })
                  }
                  disabled={aiMutation.isPending}
                >
                  {aiMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generando...</>
                  ) : (
                    <><Sparkles className="w-4 h-4 mr-2" /> Generar con IA</>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-4 mb-6">
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-green-400" />
                    <p className="text-green-400 font-medium text-sm">Sugerencias de IA</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                    <div>
                      <p className="text-white/40 text-xs">Impresiones estimadas</p>
                      <p className="text-white font-medium">{aiSuggestions.estimatedImpressions?.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-white/40 text-xs">Clics estimados</p>
                      <p className="text-white font-medium">{aiSuggestions.estimatedClicks?.toLocaleString()}</p>
                    </div>
                  </div>
                  {aiSuggestions.tips?.length > 0 && (
                    <div>
                      <p className="text-white/40 text-xs mb-1">Consejos:</p>
                      {aiSuggestions.tips.map((tip: string, i: number) => (
                        <p key={i} className="text-white/60 text-xs flex items-start gap-1.5 mb-1">
                          <Lightbulb className="w-3 h-3 text-yellow-400 flex-shrink-0 mt-0.5" /> {tip}
                        </p>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <Label className="text-white/70 text-sm">Título del anuncio</Label>
                  <Input
                    value={form.aiCopyTitle}
                    onChange={(e) => setForm({ ...form, aiCopyTitle: e.target.value })}
                    className="bg-white/5 border-white/10 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-white/70 text-sm">Subtítulo</Label>
                  <Input
                    value={form.aiCopySubtitle}
                    onChange={(e) => setForm({ ...form, aiCopySubtitle: e.target.value })}
                    className="bg-white/5 border-white/10 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-white/70 text-sm">Cuerpo del mensaje</Label>
                  <Textarea
                    value={form.aiCopyBody}
                    onChange={(e) => setForm({ ...form, aiCopyBody: e.target.value })}
                    className="bg-white/5 border-white/10 text-white mt-1 resize-none"
                    rows={3}
                  />
                </div>
                <div>
                  <Label className="text-white/70 text-sm">Texto del botón (CTA)</Label>
                  <Input
                    value={form.aiCtaText}
                    onChange={(e) => setForm({ ...form, aiCtaText: e.target.value })}
                    className="bg-white/5 border-white/10 text-white mt-1"
                  />
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/10 text-white/50 hover:bg-white/5 text-xs"
                  onClick={() => {
                    setAiSuggestions(null);
                    aiMutation.mutate({
                      objective: form.objective,
                      industry: profile?.industry ?? undefined,
                      monthlyBudget: form.budgetTotal ? parseInt(form.budgetTotal) : profile?.monthlyBudget ?? undefined,
                      targetDescription: form.targetDescription || undefined,
                    });
                  }}
                  disabled={aiMutation.isPending}
                >
                  {aiMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
                  Regenerar sugerencias
                </Button>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" className="border-white/10 text-white/60 hover:bg-white/5" onClick={() => setStep("targeting")}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Atrás
              </Button>
              <Button className="bg-green-500 hover:bg-green-600 text-white" onClick={() => setStep("budget")}>
                Continuar <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Budget */}
        {step === "budget" && (
          <div>
            <h2 className="text-white text-lg font-semibold mb-1">Presupuesto y fechas</h2>
            <p className="text-white/50 text-sm mb-6">Define cuánto quieres invertir y cuándo quieres que corra tu campaña.</p>

            <div className="mb-5">
              <Label className="text-white/70 text-sm">Presupuesto total (COP) *</Label>
              <Input
                type="number"
                value={form.budgetTotal}
                onChange={(e) => setForm({ ...form, budgetTotal: e.target.value })}
                placeholder="Ej: 500000"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 mt-1"
              />
              {aiSuggestions?.suggestedBudget && (
                <p className="text-white/30 text-xs mt-1">
                  IA sugiere: ${aiSuggestions.suggestedBudget.toLocaleString()} COP
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <Label className="text-white/70 text-sm">Fecha de inicio</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className="bg-white/5 border-white/10 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-white/70 text-sm">Fecha de fin</Label>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  className="bg-white/5 border-white/10 text-white mt-1"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="border-white/10 text-white/60 hover:bg-white/5" onClick={() => setStep("ai")}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Atrás
              </Button>
              <Button
                className="bg-green-500 hover:bg-green-600 text-white"
                onClick={() => {
                  if (!form.budgetTotal || parseInt(form.budgetTotal) < 1) {
                    toast({ title: "Error", description: "El presupuesto es requerido.", variant: "destructive" });
                    return;
                  }
                  setStep("review");
                }}
              >
                Revisar campaña <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 5: Review */}
        {step === "review" && (
          <div>
            <h2 className="text-white text-lg font-semibold mb-1">Revisa tu campaña</h2>
            <p className="text-white/50 text-sm mb-6">Confirma los detalles antes de crear la campaña.</p>

            <div className="bg-[#0d1526] border border-white/5 rounded-xl divide-y divide-white/5 mb-6">
              {[
                { label: "Nombre", value: form.name },
                { label: "Objetivo", value: OBJECTIVES.find(o => o.value === form.objective)?.label },
                { label: "Ciudades", value: form.targetCities.length > 0 ? form.targetCities.join(", ") : "Todas" },
                { label: "Marcas", value: form.targetVehicleBrands.length > 0 ? form.targetVehicleBrands.join(", ") : "Todas" },
                { label: "Presupuesto", value: `$${parseInt(form.budgetTotal).toLocaleString()} COP` },
                { label: "Inicio", value: form.startDate || "Inmediato" },
                { label: "Fin", value: form.endDate || "Sin fecha límite" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between p-4">
                  <p className="text-white/50 text-sm">{item.label}</p>
                  <p className="text-white text-sm font-medium text-right max-w-xs">{item.value}</p>
                </div>
              ))}
            </div>

            {aiSuggestions && (
              <div className="bg-green-500/5 border border-green-500/15 rounded-xl p-4 mb-6">
                <p className="text-green-400 text-sm font-medium mb-2">Copy generado por IA</p>
                <p className="text-white text-sm font-medium">{form.aiCopyTitle}</p>
                <p className="text-white/60 text-sm">{form.aiCopySubtitle}</p>
                <p className="text-white/40 text-xs mt-1">{form.aiCopyBody}</p>
              </div>
            )}

            <p className="text-white/30 text-xs mb-4">
              La campaña se creará en estado <strong className="text-white/50">Borrador</strong>. Podrás agregar creatividades y luego enviarla a revisión.
            </p>

            <div className="flex gap-3">
              <Button variant="outline" className="border-white/10 text-white/60 hover:bg-white/5" onClick={() => setStep("budget")}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Atrás
              </Button>
              <Button
                className="bg-green-500 hover:bg-green-600 text-white"
                onClick={handleCreate}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creando...</>
                ) : (
                  <><CheckCircle className="w-4 h-4 mr-2" /> Crear campaña</>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </AdvertiserLayout>
  );
}
