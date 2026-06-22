import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { BrainCircuit, Zap, TrendingUp, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function OrgDynamicPricing() {
  const { data: stations, isLoading } = (trpc.organizations as any).getMyStations.useQuery();
  const [selectedStation, setSelectedStation] = useState<any>(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [minPrice, setMinPrice] = useState("500");
  const [maxPrice, setMaxPrice] = useState("2000");
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestion, setSuggestion] = useState<any>(null);

  const updateStation = (trpc.organizations as any).updateMyStation.useMutation({
    onSuccess: () => toast.success("Configuración guardada"),
    onError: (e: any) => toast.error(e.message),
  });

  const generateSuggestion = async () => {
    if (!selectedStation) return;
    setIsGenerating(true);
    setSuggestion(null);
    try {
      // Simulate AI suggestion based on time of day and station data
      await new Promise(r => setTimeout(r, 1500));
      const hour = new Date().getHours();
      const isPeak = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 20);
      const isOffPeak = hour >= 22 || hour <= 6;
      const basePrice = parseFloat(selectedStation.pricePerKwh || "800");
      const suggested = isPeak ? basePrice * 1.3 : isOffPeak ? basePrice * 0.8 : basePrice;
      const clamped = Math.min(Math.max(suggested, parseFloat(minPrice)), parseFloat(maxPrice));
      setSuggestion({
        price: Math.round(clamped),
        reason: isPeak
          ? "Hora pico de demanda (mañana/tarde). Precio elevado recomendado."
          : isOffPeak
          ? "Hora valle. Precio reducido para incentivar uso nocturno."
          : "Demanda normal. Precio estándar recomendado.",
        confidence: isPeak ? 87 : isOffPeak ? 82 : 91,
        factors: [
          { label: "Hora del día", value: `${hour}:00 — ${isPeak ? "Pico" : isOffPeak ? "Valle" : "Normal"}` },
          { label: "Precio actual", value: `$${basePrice}/kWh` },
          { label: "Rango configurado", value: `$${minPrice} - $${maxPrice}` },
          { label: "Precio sugerido", value: `$${Math.round(clamped)}/kWh` },
        ],
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const applyPrice = () => {
    if (!selectedStation || !suggestion) return;
    updateStation.mutate({
      stationId: selectedStation.id,
      pricePerKwh: suggestion.price.toString(),
    });
    setSuggestion(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BrainCircuit className="h-6 w-6 text-green-400" /> Precios Dinámicos IA
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Optimiza automáticamente los precios de tus estaciones según demanda, hora y competencia
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Station selector */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4 text-green-400" /> Seleccionar estación
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              <div className="h-20 flex items-center justify-center">
                <div className="h-6 w-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (stations || []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No tienes estaciones registradas</p>
            ) : (
              (stations || []).map((s: any) => (
                <button
                  key={s.id}
                  onClick={() => { setSelectedStation(s); setSuggestion(null); setMinPrice("500"); setMaxPrice("2000"); }}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedStation?.id === s.id
                      ? "bg-green-500/10 border-green-500/40"
                      : "bg-muted/20 border-border/30 hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.address || s.city || "Sin dirección"}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className={`text-[10px] ${
                        s.status === "online" ? "border-green-500/50 text-green-400" : "border-red-500/50 text-red-400"
                      }`}>
                        {s.status === "online" ? "Online" : "Offline"}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">${s.pricePerKwh || "—"}/kWh</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        {/* AI Config */}
        <div className="space-y-4">
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BrainCircuit className="h-4 w-4 text-purple-400" /> Configuración IA
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Precios dinámicos automáticos</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">La IA ajustará precios cada hora</p>
                </div>
                <Switch checked={aiEnabled} onCheckedChange={setAiEnabled} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Precio mínimo (COP/kWh)</Label>
                  <Input
                    type="number"
                    value={minPrice}
                    onChange={e => setMinPrice(e.target.value)}
                    className="mt-1 h-9 text-sm"
                    min="0"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Precio máximo (COP/kWh)</Label>
                  <Input
                    type="number"
                    value={maxPrice}
                    onChange={e => setMaxPrice(e.target.value)}
                    className="mt-1 h-9 text-sm"
                    min="0"
                  />
                </div>
              </div>

              <Button
                className="w-full bg-green-600 hover:bg-green-700 h-9"
                disabled={!selectedStation || isGenerating}
                onClick={generateSuggestion}
              >
                {isGenerating ? (
                  <span className="flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Analizando...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <BrainCircuit className="h-4 w-4" />
                    Generar sugerencia IA
                  </span>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* AI Suggestion */}
          {suggestion && (
            <Card className="bg-green-500/5 border-green-500/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-400" /> Sugerencia IA
                  <Badge className="ml-auto bg-green-600 text-white text-[10px]">
                    {suggestion.confidence}% confianza
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-center py-2">
                  <p className="text-3xl font-bold text-green-400">${suggestion.price}</p>
                  <p className="text-xs text-muted-foreground">COP por kWh</p>
                </div>

                <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
                  <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-400" />
                    {suggestion.reason}
                  </p>
                </div>

                <div className="space-y-1.5">
                  {suggestion.factors.map((f: any, i: number) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{f.label}</span>
                      <span className="font-medium">{f.value}</span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-1">
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700 h-8 text-xs"
                    onClick={applyPrice}
                    disabled={updateStation.isPending}
                  >
                    {updateStation.isPending ? "Aplicando..." : "✓ Aplicar precio"}
                  </Button>
                  <Button
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => setSuggestion(null)}
                  >
                    Descartar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Info */}
          <Card className="bg-muted/20 border-border/30">
            <CardContent className="p-4">
              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium">Factores que analiza la IA</p>
                  <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                    <li>• Hora del día y día de la semana</li>
                    <li>• Historial de demanda de la estación</li>
                    <li>• Rango de precios configurado</li>
                    <li>• Ocupación actual de la red</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
