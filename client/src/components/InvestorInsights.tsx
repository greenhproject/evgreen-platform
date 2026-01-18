/**
 * Insights de IA para Inversionistas
 * Análisis y recomendaciones basadas en datos de estaciones
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  Wrench,
  Lightbulb,
  AlertTriangle,
  RefreshCw,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Minus,
} from "lucide-react";

// ============================================================================
// TIPOS
// ============================================================================

interface InsightMetric {
  value: number;
  unit: string;
  change?: number;
  trend?: "up" | "down" | "stable";
}

interface InvestorInsight {
  type: "revenue" | "usage" | "maintenance" | "opportunity" | "warning";
  title: string;
  description: string;
  metric?: InsightMetric;
  recommendation?: string;
  priority: "low" | "medium" | "high";
  stationId?: number;
}

// ============================================================================
// COMPONENTE DE TARJETA DE INSIGHT
// ============================================================================

function InsightCard({ insight }: { insight: InvestorInsight }) {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case "revenue":
        return <DollarSign className="h-5 w-5" />;
      case "usage":
        return <Activity className="h-5 w-5" />;
      case "maintenance":
        return <Wrench className="h-5 w-5" />;
      case "opportunity":
        return <Lightbulb className="h-5 w-5" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5" />;
      default:
        return <Sparkles className="h-5 w-5" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "revenue":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "usage":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "maintenance":
        return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      case "opportunity":
        return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      case "warning":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high":
        return <Badge variant="destructive">Alta prioridad</Badge>;
      case "medium":
        return <Badge variant="outline" className="border-yellow-500 text-yellow-500">Media</Badge>;
      case "low":
        return <Badge variant="outline">Baja</Badge>;
      default:
        return null;
    }
  };

  const getTrendIcon = (trend?: string) => {
    switch (trend) {
      case "up":
        return <ArrowUp className="h-4 w-4 text-green-500" />;
      case "down":
        return <ArrowDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Icono del tipo */}
          <div className={`shrink-0 h-10 w-10 rounded-lg flex items-center justify-center ${getTypeColor(insight.type)}`}>
            {getTypeIcon(insight.type)}
          </div>

          {/* Contenido */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-semibold">{insight.title}</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  {insight.description}
                </p>
              </div>
              {getPriorityBadge(insight.priority)}
            </div>

            {/* Métrica */}
            {insight.metric && (
              <div className="mt-3 flex items-center gap-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold">
                    {insight.metric.unit === "COP" && "$"}
                    {insight.metric.value.toLocaleString()}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {insight.metric.unit !== "COP" && insight.metric.unit}
                  </span>
                </div>
                {insight.metric.change !== undefined && (
                  <div className="flex items-center gap-1">
                    {getTrendIcon(insight.metric.trend)}
                    <span className={`text-sm font-medium ${
                      insight.metric.trend === "up" ? "text-green-500" :
                      insight.metric.trend === "down" ? "text-red-500" :
                      "text-muted-foreground"
                    }`}>
                      {insight.metric.change > 0 ? "+" : ""}{insight.metric.change}%
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Recomendación */}
            {insight.recommendation && (
              <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
                <p className="text-sm">
                  <Lightbulb className="h-4 w-4 inline mr-2 text-primary" />
                  {insight.recommendation}
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export function InvestorInsights({ stationIds }: { stationIds?: number[] }) {
  const [period, setPeriod] = useState<"day" | "week" | "month" | "quarter" | "year">("month");

  // Query de insights
  const {
    data: insights,
    isLoading,
    refetch,
    isRefetching,
  } = trpc.ai.getInvestorInsights.useQuery({
    stationIds,
    period,
  });

  const periodLabels: Record<string, string> = {
    day: "Último día",
    week: "Última semana",
    month: "Último mes",
    quarter: "Último trimestre",
    year: "Último año",
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Insights de IA
            </CardTitle>
            <CardDescription>
              Análisis y recomendaciones basadas en tus datos
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Último día</SelectItem>
                <SelectItem value="week">Última semana</SelectItem>
                <SelectItem value="month">Último mes</SelectItem>
                <SelectItem value="quarter">Último trimestre</SelectItem>
                <SelectItem value="year">Último año</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              disabled={isRefetching}
            >
              <RefreshCw className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-8 w-1/3" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : insights && insights.length > 0 ? (
          <div className="space-y-4">
            {insights.map((insight, index) => (
              <InsightCard key={index} insight={insight} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">Sin insights disponibles</h3>
            <p className="text-sm text-muted-foreground">
              No hay suficientes datos para generar insights en este período
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default InvestorInsights;
