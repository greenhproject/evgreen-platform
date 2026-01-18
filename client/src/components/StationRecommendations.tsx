/**
 * Recomendaciones de Estaciones de Carga con IA
 * Sugiere las mejores estaciones basadas en ubicación y preferencias
 */

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useLocation } from "wouter";
import {
  Sparkles,
  MapPin,
  Clock,
  DollarSign,
  Zap,
  Navigation,
  Star,
  TrendingUp,
  TrendingDown,
  Loader2,
  ChevronRight,
  RefreshCw,
} from "lucide-react";

// ============================================================================
// TIPOS
// ============================================================================

interface ChargingRecommendation {
  stationId: number;
  stationName: string;
  address: string;
  distance: number;
  estimatedWaitTime: number;
  currentPrice: number;
  demandLevel: "LOW" | "NORMAL" | "HIGH" | "SURGE";
  reason: string;
  score: number;
}

// ============================================================================
// COMPONENTE DE TARJETA DE RECOMENDACIÓN
// ============================================================================

function RecommendationCard({
  recommendation,
  index,
  onSelect,
}: {
  recommendation: ChargingRecommendation;
  index: number;
  onSelect: () => void;
}) {
  const getDemandBadge = (level: string) => {
    switch (level) {
      case "LOW":
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Baja demanda</Badge>;
      case "NORMAL":
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">Normal</Badge>;
      case "HIGH":
        return <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20">Alta demanda</Badge>;
      case "SURGE":
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">Muy alta</Badge>;
      default:
        return null;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    return "text-orange-500";
  };

  return (
    <Card
      className="cursor-pointer hover:border-primary/50 transition-colors"
      onClick={onSelect}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Ranking */}
          <div className="shrink-0 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-lg font-bold text-primary">#{index + 1}</span>
          </div>

          {/* Información */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-semibold truncate">{recommendation.stationName}</h4>
                <p className="text-sm text-muted-foreground truncate">
                  {recommendation.address}
                </p>
              </div>
              <div className="text-right shrink-0">
                <div className={`text-lg font-bold ${getScoreColor(recommendation.score)}`}>
                  {recommendation.score}
                </div>
                <p className="text-xs text-muted-foreground">puntos</p>
              </div>
            </div>

            {/* Métricas */}
            <div className="flex flex-wrap gap-3 mt-3">
              <div className="flex items-center gap-1 text-sm">
                <Navigation className="h-4 w-4 text-muted-foreground" />
                <span>{recommendation.distance.toFixed(1)} km</span>
              </div>
              <div className="flex items-center gap-1 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{recommendation.estimatedWaitTime} min espera</span>
              </div>
              <div className="flex items-center gap-1 text-sm">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span>${recommendation.currentPrice.toLocaleString()}/kWh</span>
              </div>
            </div>

            {/* Demanda y razón */}
            <div className="flex items-center gap-2 mt-3">
              {getDemandBadge(recommendation.demandLevel)}
            </div>

            {/* Razón de la recomendación */}
            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
              <Sparkles className="h-3 w-3 inline mr-1 text-primary" />
              {recommendation.reason}
            </p>
          </div>

          <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export function StationRecommendations() {
  const [, setLocation] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Obtener ubicación del usuario
  useEffect(() => {
    if (isOpen && !userLocation) {
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setUserLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            });
            setLocationError(null);
          },
          (error) => {
            console.error("Error getting location:", error);
            // Usar ubicación por defecto (Bogotá)
            setUserLocation({ lat: 4.7110, lng: -74.0721 });
            setLocationError("No se pudo obtener tu ubicación. Mostrando estaciones cerca de Bogotá.");
          }
        );
      } else {
        setUserLocation({ lat: 4.7110, lng: -74.0721 });
        setLocationError("Tu navegador no soporta geolocalización.");
      }
    }
  }, [isOpen, userLocation]);

  // Query de recomendaciones
  const {
    data: recommendations,
    isLoading,
    refetch,
    isRefetching,
  } = trpc.ai.getChargingRecommendations.useQuery(
    {
      latitude: userLocation?.lat || 4.7110,
      longitude: userLocation?.lng || -74.0721,
      maxDistance: 20,
    },
    {
      enabled: isOpen && !!userLocation,
    }
  );

  const handleSelectStation = (stationId: number) => {
    setIsOpen(false);
    setLocation(`/station/${stationId}`);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button className="gap-2">
          <Sparkles className="h-4 w-4" />
          Recomendaciones IA
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:w-[450px] p-0 flex flex-col">
        <SheetHeader className="p-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Recomendaciones IA
              </SheetTitle>
              <SheetDescription>
                Las mejores estaciones según tu ubicación
              </SheetDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              disabled={isRefetching}
            >
              <RefreshCw className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 p-4">
          {locationError && (
            <div className="mb-4 p-3 rounded-lg bg-yellow-500/10 text-yellow-600 text-sm">
              {locationError}
            </div>
          )}

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                        <div className="flex gap-2">
                          <Skeleton className="h-4 w-16" />
                          <Skeleton className="h-4 w-16" />
                          <Skeleton className="h-4 w-16" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : recommendations && recommendations.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>
                  {recommendations.length} estaciones encontradas cerca de ti
                </span>
              </div>

              {recommendations.map((rec, index) => (
                <RecommendationCard
                  key={rec.stationId}
                  recommendation={rec}
                  index={index}
                  onSelect={() => handleSelectStation(rec.stationId)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No hay estaciones cercanas</h3>
              <p className="text-sm text-muted-foreground">
                No encontramos estaciones de carga en un radio de 20 km
              </p>
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

export default StationRecommendations;
