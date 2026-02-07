import { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";
import UserLayout from "@/layouts/UserLayout";
import { MapView } from "@/components/Map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Search,
  Filter,
  Navigation,
  RefreshCw,
  Zap,
  MapPin,
  Clock,
  ChevronRight,
  Wallet,
  CreditCard,
  Car,
  X,
  Sparkles,
  Heart
} from "lucide-react";
import { AIInsightCard } from "@/components/AIInsightCard";

// Tipo inferido del API - usamos any para flexibilidad con datos del backend
type StationData = {
  station: {
    id: number;
    name: string;
    address: string;
    city: string;
    latitude: string;
    longitude: string;
    isOnline?: boolean;
  };
  distance: number;
  evses?: Array<{
    id: number;
    status: string;
    connectorType: string;
    chargeType?: string;
    powerKw: string;
  }>;
};

// Helper para normalizar datos de estación
const normalizeStation = (data: StationData | any) => {
  if ('station' in data) {
    return {
      ...data.station,
      evses: data.evses || [],
      isOnline: data.station.isOnline ?? true,
      distance: data.distance,
    };
  }
  return {
    ...data,
    evses: data.evses || [],
    isOnline: data.isOnline ?? true,
  };
};

interface Station {
  id: number;
  name: string;
  address: string;
  city: string;
  latitude: string;
  longitude: string;
  isOnline: boolean;
  distance?: number;
  calculatedDistance?: number;
  evses: Array<{
    id: number;
    status: string;
    connectorType: string;
    chargeType?: string;
    powerKw: string;
  }>;
}

// Componente de botón de favorito
function FavoriteButton({ stationId }: { stationId: number }) {
  const utils = trpc.useUtils();
  const { data: isFavorite, isLoading } = trpc.favorites.isFavorite.useQuery({ stationId });
  const toggleMutation = trpc.favorites.toggle.useMutation({
    onMutate: async () => {
      // Optimistic update
      await utils.favorites.isFavorite.cancel({ stationId });
      const prev = utils.favorites.isFavorite.getData({ stationId });
      utils.favorites.isFavorite.setData({ stationId }, !prev);
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev !== undefined) {
        utils.favorites.isFavorite.setData({ stationId }, context.prev);
      }
    },
    onSettled: () => {
      utils.favorites.isFavorite.invalidate({ stationId });
      utils.favorites.getMyFavorites.invalidate();
    },
  });

  return (
    <Button
      variant="ghost"
      size="icon"
      className="rounded-full -mt-1"
      onClick={(e) => {
        e.stopPropagation();
        toggleMutation.mutate({ stationId });
      }}
      disabled={isLoading || toggleMutation.isPending}
    >
      <Heart
        className={`w-5 h-5 transition-colors ${
          isFavorite
            ? "fill-red-500 text-red-500"
            : "text-muted-foreground hover:text-red-400"
        }`}
      />
    </Button>
  );
}

export default function UserMap() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    connectorType: "all",
    chargeType: "all",
    available: true,
  });

  // Obtener estaciones - sin filtro de ubicación para mostrar todas las estaciones públicas
  const { data: stations, isLoading, refetch } = trpc.stations.listPublic.useQuery({});

  // Obtener billetera del usuario
  const { data: wallet } = trpc.wallet.getMyWallet.useQuery();

  // Obtener ubicación del usuario
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error("Error getting location:", error);
          // Default: Bogotá
          setUserLocation({ lat: 4.7110, lng: -74.0721 });
        }
      );
    }
  }, []);

  // Centrar mapa en ubicación del usuario
  const centerOnUser = () => {
    if (mapInstance && userLocation) {
      mapInstance.panTo(userLocation);
      mapInstance.setZoom(15);
    }
  };

  // Manejar selección de estación
  const handleStationSelect = (station: Station) => {
    setSelectedStation(station);
    if (mapInstance) {
      mapInstance.panTo({
        lat: parseFloat(station.latitude),
        lng: parseFloat(station.longitude),
      });
      mapInstance.setZoom(17);
    }
  };

  // Obtener estado de disponibilidad
  const getAvailableCount = (station: Station) => {
    return station.evses?.filter((e) => e.status === "AVAILABLE").length || 0;
  };

  const getTotalCount = (station: Station) => {
    return station.evses?.length || 0;
  };

    // Fórmula Haversine para calcular distancia entre dos coordenadas GPS (en km)
  const haversineDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Radio de la Tierra en km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, []);

  // Formatear distancia para mostrar
  const formatDistance = useCallback((distanceKm: number): string => {
    if (distanceKm < 1) {
      return `${Math.round(distanceKm * 1000)} m`;
    }
    if (distanceKm < 10) {
      return `${distanceKm.toFixed(1)} km`;
    }
    return `${Math.round(distanceKm)} km`;
  }, []);

  // Normalizar, calcular distancias y filtrar estaciones
  const normalizedStations: Station[] = stations?.map((s: any) => normalizeStation(s)) || [];

  // Calcular distancia real para cada estación
  const stationsWithDistance = useMemo(() => {
    return normalizedStations.map((station) => {
      if (userLocation) {
        const lat = parseFloat(station.latitude);
        const lng = parseFloat(station.longitude);
        if (!isNaN(lat) && !isNaN(lng)) {
          const dist = haversineDistance(userLocation.lat, userLocation.lng, lat, lng);
          return { ...station, calculatedDistance: dist };
        }
      }
      return { ...station, calculatedDistance: undefined as number | undefined };
    });
  }, [normalizedStations, userLocation, haversineDistance]);
  
  const filteredStations = useMemo(() => {
    const filtered = stationsWithDistance.filter((station) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !station.name.toLowerCase().includes(query) &&
          !station.address.toLowerCase().includes(query) &&
          !station.city.toLowerCase().includes(query)
        ) {
          return false;
        }
      }
      // Filtro por tipo de carga (AC/DC)
      if (filters.chargeType !== "all" && station.evses) {
        const hasMatchingEvse = station.evses.some((e) => e.chargeType === filters.chargeType);
        if (!hasMatchingEvse) return false;
      }
      // Filtro por tipo de conector
      if (filters.connectorType !== "all" && station.evses) {
        const hasMatchingConnector = station.evses.some((e) => e.connectorType === filters.connectorType);
        if (!hasMatchingConnector) return false;
      }
      // Filtro por disponibilidad
      if (filters.available && getAvailableCount(station) === 0) {
        return false;
      }
      return true;
    });
    // Ordenar por distancia (más cercanas primero)
    return filtered.sort((a, b) => {
      if (a.calculatedDistance !== undefined && b.calculatedDistance !== undefined) {
        return a.calculatedDistance - b.calculatedDistance;
      }
      if (a.calculatedDistance !== undefined) return -1;
      if (b.calculatedDistance !== undefined) return 1;
      return 0;
    });
  }, [stationsWithDistance, searchQuery, filters]);

  // Agregar marcadores de estaciones filtradas al mapa
  useEffect(() => {
    if (!mapInstance) return;

    // Limpiar marcadores anteriores
    const markers: google.maps.marker.AdvancedMarkerElement[] = [];

    // Crear marcadores para cada estación filtrada
    filteredStations.forEach((station) => {
      const lat = parseFloat(station.latitude);
      const lng = parseFloat(station.longitude);
      
      if (isNaN(lat) || isNaN(lng)) return;

      // Determinar tipo de carga de la estación
      const hasDC = station.evses?.some((e) => e.chargeType === 'DC');
      const hasAC = station.evses?.some((e) => e.chargeType === 'AC');
      const availableCount = station.evses?.filter((e) => e.status === 'AVAILABLE').length || 0;
      const isAvailable = availableCount > 0;

      // Colores según tipo: DC=azul eléctrico, AC=ámbar, Mixto=verde
      let bgColor = '#10b981';
      let borderColor = '#059669';
      let label = '⚡';
      if (hasDC && hasAC) {
        bgColor = '#10b981';
        borderColor = '#059669';
        label = 'AC/DC';
      } else if (hasDC) {
        bgColor = '#3b82f6';
        borderColor = '#2563eb';
        label = 'DC';
      } else if (hasAC) {
        bgColor = '#f59e0b';
        borderColor = '#d97706';
        label = 'AC';
      }

      const opacity = isAvailable ? '1' : '0.6';

      const markerContent = document.createElement('div');
      markerContent.style.cssText = `
        display: flex; flex-direction: column; align-items: center; cursor: pointer;
        opacity: 0; transform: scale(0.5); transition: opacity 0.35s ease-out, transform 0.35s cubic-bezier(0.34,1.56,0.64,1);
      `;
      // Animar entrada con delay escalonado
      const stationIndex = filteredStations.indexOf(station);
      requestAnimationFrame(() => {
        setTimeout(() => {
          markerContent.style.opacity = opacity;
          markerContent.style.transform = 'scale(1)';
        }, stationIndex * 80);
      });
      markerContent.innerHTML = `
        <div style="
          display: flex; align-items: center; justify-content: center;
          width: 44px; height: 44px; border-radius: 50%;
          background: ${bgColor}; border: 3px solid ${borderColor};
          box-shadow: 0 4px 12px ${bgColor}44, 0 2px 4px rgba(0,0,0,0.3);
          position: relative;
        ">
          <svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"white\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\">
            <path d=\"M13 2L3 14h9l-1 8 10-12h-9l1-8z\"/>
          </svg>
          ${!isAvailable ? '<div style="position:absolute;top:-2px;right:-2px;width:12px;height:12px;border-radius:50%;background:#ef4444;border:2px solid white;"></div>' : ''}
        </div>
        <div style="
          margin-top: 4px; padding: 1px 6px; border-radius: 8px;
          background: ${bgColor}; color: white;
          font-size: 9px; font-weight: 700; letter-spacing: 0.5px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        ">${label}</div>
        <div style="
          width: 0; height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-top: 6px solid ${bgColor};
          margin-top: -1px;
        "></div>
      `;

      const marker = new google.maps.marker.AdvancedMarkerElement({
        map: mapInstance,
        position: { lat, lng },
        title: station.name,
        content: markerContent,
      });

      marker.addListener('click', () => {
        handleStationSelect(station);
      });

      markers.push(marker);
    });

    // Si hay estaciones y no hay ubicación del usuario, centrar en la primera
    if (filteredStations.length > 0 && !userLocation) {
      const first = filteredStations[0];
      const lat = parseFloat(first.latitude);
      const lng = parseFloat(first.longitude);
      if (!isNaN(lat) && !isNaN(lng)) {
        mapInstance.setCenter({ lat, lng });
        mapInstance.setZoom(12);
      }
    }

    return () => {
      // Animar salida antes de remover
      markers.forEach((marker, i) => {
        const el = marker.content as HTMLElement;
        if (el && el.style) {
          el.style.opacity = '0';
          el.style.transform = 'scale(0.5)';
        }
      });
      // Remover después de la animación
      setTimeout(() => {
        markers.forEach(marker => marker.map = null);
      }, 300);
    };
  }, [mapInstance, filteredStations, userLocation]);

  return (
    <UserLayout showHeader={false} showBottomNav={true}>
      <div className="relative h-[calc(100vh-4rem)]">
        {/* Mapa */}
        <div className="absolute inset-0">
          <MapView
            onMapReady={(map) => {
              setMapInstance(map);
              if (userLocation) {
                map.setCenter(userLocation);
                map.setZoom(14);
              }
            }}
            className="w-full h-full"
          />
        </div>

        {/* Overlay de búsqueda */}
        <div className="absolute top-0 left-0 right-0 p-4 safe-area-inset-top">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Buscar estaciones cercanas"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 h-12 rounded-xl bg-gray-900/90 backdrop-blur-md border-gray-700/60 shadow-xl text-white placeholder:text-gray-400"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-12 w-12 rounded-xl bg-gray-900/90 backdrop-blur-md border-gray-700/60 shadow-xl text-white hover:bg-gray-800/95"
              onClick={() => setShowFilters(true)}
            >
              <Filter className="w-5 h-5" />
            </Button>
          </div>

          {/* Chips de filtro rápido */}
          <div className="flex gap-2 mt-2 overflow-x-auto no-scrollbar">
            {["all", "AC", "DC"].map((type) => (
              <button
                key={type}
                onClick={() => setFilters({ ...filters, chargeType: type })}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 shadow-lg ${
                  filters.chargeType === type
                    ? "bg-emerald-500 text-white shadow-emerald-500/30"
                    : "bg-gray-900/80 backdrop-blur-md text-gray-300 border border-gray-700/60 hover:bg-gray-800/90"
                }`}
              >
                {type === "all" ? "⚡ Todos" : type === "AC" ? "🔌 AC" : "⚡ DC Rápida"}
              </button>
            ))}
            <button
              onClick={() => setFilters({ ...filters, available: !filters.available })}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 shadow-lg ${
                filters.available
                  ? "bg-emerald-500 text-white shadow-emerald-500/30"
                  : "bg-gray-900/80 backdrop-blur-md text-gray-300 border border-gray-700/60 hover:bg-gray-800/90"
              }`}
            >
              ✅ Disponibles
            </button>
          </div>
        </div>

        {/* Widget de sugerencia de IA */}
        <div className="absolute left-4 top-24 right-4 sm:right-20 max-w-sm z-10">
          <AIInsightCard 
            type="map" 
            className="bg-gray-900/90 backdrop-blur-md shadow-xl border border-gray-700/60"
            onAskAI={(question) => {
              // Abrir el chat de IA con la pregunta
              const chatButton = document.querySelector('[data-ai-chat-trigger]') as HTMLButtonElement;
              if (chatButton) chatButton.click();
            }}
          />
        </div>

        {/* Botones flotantes */}
        <TooltipProvider delayDuration={300}>
          <div className="absolute right-4 top-24 flex flex-col gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 rounded-full bg-gray-900/90 backdrop-blur-md shadow-xl border border-gray-700/60 text-white hover:bg-gray-800/95"
                  onClick={() => refetch()}
                >
                  <RefreshCw className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" className="bg-gray-900 text-white border-gray-700">
                Actualizar estaciones
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 rounded-full bg-emerald-600/90 backdrop-blur-md shadow-xl border border-emerald-500/60 text-white hover:bg-emerald-500/95"
                  onClick={centerOnUser}
                >
                  <Navigation className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" className="bg-gray-900 text-white border-gray-700">
                Mi ubicación
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>

        {/* Lista de estaciones (bottom sheet) */}
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              className="absolute bottom-36 left-1/2 -translate-x-1/2 h-10 px-5 rounded-full bg-gray-900/90 backdrop-blur-md shadow-xl border border-gray-700/60 text-white hover:bg-gray-800/95 text-sm font-medium"
            >
              {filteredStations.length} estaciones cerca
              <ChevronRight className="w-4 h-4 ml-1 rotate-90" />
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[60vh] rounded-t-3xl p-0">
            <div className="p-4 border-b">
              <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
              <h3 className="font-semibold text-lg">Estaciones cercanas</h3>
              <p className="text-sm text-muted-foreground">
                {filteredStations.length} estaciones disponibles
              </p>
            </div>
            <div className="overflow-auto h-[calc(60vh-5rem)] p-4 space-y-3">
              {filteredStations.map((station) => (
                <Card
                  key={station.id}
                  className="p-4 cursor-pointer card-interactive"
                  onClick={() => handleStationSelect(station)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">{station.name}</h4>
                        {station.calculatedDistance !== undefined && (
                          <span className="text-xs text-muted-foreground font-medium bg-muted/50 px-2 py-0.5 rounded-full whitespace-nowrap">
                            <Navigation className="w-3 h-3 inline mr-0.5" />
                            {formatDistance(station.calculatedDistance)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3 shrink-0" />
                        {station.address}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge
                          variant={getAvailableCount(station) > 0 ? "default" : "secondary"}
                          className={getAvailableCount(station) > 0 ? "bg-primary/10 text-primary" : ""}
                        >
                          {getAvailableCount(station)}/{getTotalCount(station)} disponibles
                        </Badge>
                        {station.evses?.[0] && (
                          <Badge variant="outline" className="text-xs">
                            {station.evses[0].powerKw} kW
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <FavoriteButton stationId={station.id} />
                      <div className={`w-3 h-3 rounded-full ${
                        station.isOnline ? "status-available" : "status-faulted"
                      }`} />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </SheetContent>
        </Sheet>

        {/* Detalle de estación seleccionada */}
        <AnimatePresence>
          {selectedStation && (
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="absolute bottom-20 left-4 right-4"
            >
              <Card className="p-4 shadow-2xl border-primary/20">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="font-semibold text-lg">{selectedStation.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {selectedStation.address}, {selectedStation.city}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <FavoriteButton stationId={selectedStation.id} />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-full -mt-1 -mr-1"
                      onClick={() => setSelectedStation(null)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-4 mb-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      getAvailableCount(selectedStation) > 0 ? "bg-primary" : "bg-muted"
                    }`} />
                    <span className="text-sm">
                      {getAvailableCount(selectedStation)} de {getTotalCount(selectedStation)} disponibles
                    </span>
                  </div>
                  {selectedStation.calculatedDistance !== undefined && (
                    <div className="flex items-center gap-1 text-sm text-primary font-medium">
                      <Navigation className="w-4 h-4" />
                      {formatDistance(selectedStation.calculatedDistance)}
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    24/7
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    className="flex-1 gradient-primary text-white"
                    onClick={() => setLocation(`/station/${selectedStation.id}`)}
                  >
                    Ver detalles
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      // Abrir navegación
                      window.open(
                        `https://www.google.com/maps/dir/?api=1&destination=${selectedStation.latitude},${selectedStation.longitude}`,
                        "_blank"
                      );
                    }}
                  >
                    <Navigation className="w-4 h-4 mr-2" />
                    Ir
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal de filtros */}
        <Sheet open={showFilters} onOpenChange={setShowFilters}>
          <SheetContent side="bottom" className="rounded-t-3xl">
            <div className="p-4">
              <h3 className="font-semibold text-lg mb-4">Filtros</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Tipo de conector</label>
                  <div className="flex gap-2 flex-wrap">
                    {["all", "TYPE_2", "CCS_2", "CHADEMO"].map((type) => (
                      <Button
                        key={type}
                        variant={filters.connectorType === type ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFilters({ ...filters, connectorType: type })}
                      >
                        {type === "all" ? "Todos" : type.replace("_", " ")}
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Tipo de carga</label>
                  <div className="flex gap-2">
                    {["all", "AC", "DC"].map((type) => (
                      <Button
                        key={type}
                        variant={filters.chargeType === type ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFilters({ ...filters, chargeType: type })}
                      >
                        {type === "all" ? "Todos" : type}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Solo disponibles</label>
                  <Button
                    variant={filters.available ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilters({ ...filters, available: !filters.available })}
                  >
                    {filters.available ? "Sí" : "No"}
                  </Button>
                </div>
              </div>

              <Button
                className="w-full mt-6"
                onClick={() => setShowFilters(false)}
              >
                Aplicar filtros
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </UserLayout>
  );
}
