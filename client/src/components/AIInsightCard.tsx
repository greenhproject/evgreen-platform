/**
 * AI Insight Card Component
 * Muestra sugerencias contextuales de IA en diferentes partes de la aplicación
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Sparkles, 
  ChevronRight, 
  Lightbulb, 
  TrendingDown, 
  Clock, 
  MapPin,
  Zap,
  X
} from "lucide-react";
import { trpc } from "@/lib/trpc";

interface AIInsightCardProps {
  type: "station" | "map" | "history" | "wallet" | "general";
  stationId?: number;
  className?: string;
  onAskAI?: (question: string) => void;
}

interface Insight {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: string;
  actionQuestion?: string;
  type: "tip" | "saving" | "recommendation" | "alert";
}

export function AIInsightCard({ type, stationId, className, onAskAI }: AIInsightCardProps) {
  const [dismissed, setDismissed] = useState(false);
  const [currentInsightIndex, setCurrentInsightIndex] = useState(0);

  // Obtener insights basados en el contexto
  const insights = getContextualInsights(type, stationId);

  if (dismissed || insights.length === 0) {
    return null;
  }

  const currentInsight = insights[currentInsightIndex];

  const handleNext = () => {
    setCurrentInsightIndex((prev) => (prev + 1) % insights.length);
  };

  const handleAskAI = () => {
    if (onAskAI && currentInsight.actionQuestion) {
      onAskAI(currentInsight.actionQuestion);
    }
  };

  const getTypeColor = (insightType: string) => {
    switch (insightType) {
      case "saving":
        return "bg-green-500/10 border-green-500/30 text-green-400";
      case "recommendation":
        return "bg-blue-500/10 border-blue-500/30 text-blue-400";
      case "alert":
        return "bg-orange-500/10 border-orange-500/30 text-orange-400";
      default:
        return "bg-purple-500/10 border-purple-500/30 text-purple-400";
    }
  };

  return (
    <Card className={`relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 to-transparent ${className}`}>
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-sm font-medium">Sugerencia de IA</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {insights.length > 1 && (
              <Badge variant="outline" className="text-xs">
                {currentInsightIndex + 1}/{insights.length}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-destructive/20 rounded-full"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDismissed(true);
              }}
              aria-label="Cerrar sugerencia"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className={`flex items-start gap-3 p-3 rounded-lg border ${getTypeColor(currentInsight.type)}`}>
          <div className="mt-0.5">{currentInsight.icon}</div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{currentInsight.title}</p>
            <p className="text-xs text-muted-foreground mt-1">{currentInsight.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {currentInsight.action && onAskAI && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs"
              onClick={handleAskAI}
            >
              <Sparkles className="h-3 w-3 mr-1" />
              {currentInsight.action}
            </Button>
          )}
          {insights.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNext}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function getContextualInsights(type: string, stationId?: number): Insight[] {
  const now = new Date();
  const hour = now.getHours();
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;
  const isPeakHour = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 20);

  const insights: Insight[] = [];

  // Insights basados en el tipo de página
  switch (type) {
    case "station":
      if (isPeakHour) {
        insights.push({
          icon: <Clock className="h-4 w-4" />,
          title: "Hora pico detectada",
          description: "Los precios son más altos ahora. Considera cargar después de las 20:00 para ahorrar hasta un 25%.",
          action: "¿Cuándo es mejor cargar?",
          actionQuestion: "¿Cuál es el mejor horario para cargar hoy y ahorrar dinero?",
          type: "saving",
        });
      } else {
        insights.push({
          icon: <TrendingDown className="h-4 w-4" />,
          title: "¡Buen momento para cargar!",
          description: "La demanda está baja y los precios son favorables. Aprovecha ahora.",
          action: "Ver estimación de costo",
          actionQuestion: "¿Cuánto me costaría cargar 30 kWh ahora en esta estación?",
          type: "tip",
        });
      }
      insights.push({
        icon: <Zap className="h-4 w-4" />,
        title: "Optimiza tu carga",
        description: "Cargar hasta el 80% es más eficiente y rápido que cargar al 100%.",
        action: "Más consejos",
        actionQuestion: "¿Cuáles son los mejores consejos para optimizar la carga de mi vehículo eléctrico?",
        type: "tip",
      });
      break;

    case "map":
      insights.push({
        icon: <MapPin className="h-4 w-4" />,
        title: "Estaciones cercanas",
        description: "Pregúntame por la mejor estación según tu ubicación, precio y disponibilidad.",
        action: "Encontrar mejor estación",
        actionQuestion: "¿Cuál es la mejor estación de carga cerca de mi ubicación actual?",
        type: "recommendation",
      });
      if (isPeakHour) {
        insights.push({
          icon: <Clock className="h-4 w-4" />,
          title: "Evita la espera",
          description: "Algunas estaciones pueden estar ocupadas. Te ayudo a encontrar una disponible.",
          action: "Ver disponibilidad",
          actionQuestion: "¿Qué estaciones tienen conectores disponibles ahora mismo?",
          type: "alert",
        });
      }
      break;

    case "history":
      insights.push({
        icon: <Lightbulb className="h-4 w-4" />,
        title: "Análisis de tu historial",
        description: "Puedo analizar tus patrones de carga y darte recomendaciones personalizadas.",
        action: "Analizar mis cargas",
        actionQuestion: "Analiza mi historial de cargas y dame recomendaciones para ahorrar dinero.",
        type: "recommendation",
      });
      insights.push({
        icon: <TrendingDown className="h-4 w-4" />,
        title: "Optimiza tus gastos",
        description: "Descubre cuánto podrías ahorrar cargando en horarios de baja demanda.",
        action: "Ver potencial de ahorro",
        actionQuestion: "¿Cuánto podría ahorrar si cambio mis horarios de carga a horas valle?",
        type: "saving",
      });
      break;

    case "wallet":
      insights.push({
        icon: <Lightbulb className="h-4 w-4" />,
        title: "Gestión inteligente",
        description: "Te ayudo a planificar tus recargas de saldo basado en tu consumo promedio.",
        action: "Planificar recargas",
        actionQuestion: "Basado en mi consumo, ¿cuánto saldo debería mantener en mi billetera?",
        type: "tip",
      });
      break;

    default:
      insights.push({
        icon: <Sparkles className="h-4 w-4" />,
        title: "Asistente disponible",
        description: "Pregúntame sobre estaciones, precios, planificación de viajes o cualquier duda sobre carga de vehículos eléctricos.",
        action: "Hacer una pregunta",
        actionQuestion: "¿Qué puedes hacer por mí?",
        type: "tip",
      });
  }

  return insights;
}

export default AIInsightCard;
