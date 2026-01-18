import { useState, useEffect } from "react";
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
  Sparkles
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
  evses: Array<{
    id: number;
    status: string;
    connectorType: string;
    powerKw: string;
  }>;
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

  // Agregar marcadores de estaciones al mapa
  useEffect(() => {
    if (!mapInstance || !stations || stations.length === 0) return;

    // Limpiar marcadores anteriores (si los hubiera)
    const markers: google.maps.marker.AdvancedMarkerElement[] = [];

    // Crear marcadores para cada estación
    stations.forEach((stationData: any) => {
      const station = 'station' in stationData ? stationData.station : stationData;
      const lat = parseFloat(station.latitude);
      const lng = parseFloat(station.longitude);
      
      if (isNaN(lat) || isNaN(lng)) return;

      // Crear elemento personalizado para el marcador
      const markerContent = document.createElement('div');
      markerContent.className = 'flex items-center justify-center w-10 h-10 rounded-full bg-primary text-white shadow-lg cursor-pointer';
      markerContent.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 18H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3.19M15 6h2.81A2 2 0 0 1 20 8v8a2 2 0 0 1-2 2h-2"/><path d="M15 2v4"/><path d="M9 2v4"/><path d="M7 10v4"/><path d="M17 10v4"/></svg>`;

      const marker = new google.maps.marker.AdvancedMarkerElement({
        map: mapInstance,
        position: { lat, lng },
        title: station.name,
        content: markerContent,
      });

      // Agregar evento de clic
      marker.addListener('click', () => {
        const normalizedStation = normalizeStation(stationData);
        handleStationSelect(normalizedStation);
      });

      markers.push(marker);
    });

    // Si hay estaciones y no hay ubicación del usuario, centrar en la primera estación
    if (stations.length > 0 && !userLocation) {
      const firstStation = 'station' in stations[0] ? stations[0].station : stations[0];
      const lat = parseFloat(firstStation.latitude);
      const lng = parseFloat(firstStation.longitude);
      if (!isNaN(lat) && !isNaN(lng)) {
        mapInstance.setCenter({ lat, lng });
        mapInstance.setZoom(12);
      }
    }

    // Cleanup
    return () => {
      markers.forEach(marker => marker.map = null);
    };
  }, [mapInstance, stations, userLocation]);

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

  // Normalizar y filtrar estaciones
  const normalizedStations: Station[] = stations?.map((s: any) => normalizeStation(s)) || [];
  
  const filteredStations = normalizedStations.filter((station) => {
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
    if (filters.available && getAvailableCount(station) === 0) {
      return false;
    }
    return true;
  });

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
                className="pl-10 pr-4 h-12 rounded-xl bg-card/95 backdrop-blur-sm border-border/50 shadow-lg"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-12 w-12 rounded-xl bg-card/95 backdrop-blur-sm border-border/50 shadow-lg"
              onClick={() => setShowFilters(true)}
            >
              <Filter className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Widget de sugerencia de IA */}
        <div className="absolute left-4 top-24 right-20 max-w-sm">
          <AIInsightCard 
            type="map" 
            className="bg-card/95 backdrop-blur-sm shadow-lg"
            onAskAI={(question) => {
              // Abrir el chat de IA con la pregunta
              const chatButton = document.querySelector('[data-ai-chat-trigger]') as HTMLButtonElement;
              if (chatButton) chatButton.click();
            }}
          />
        </div>

        {/* Botones flotantes */}
        <div className="absolute right-4 top-24 flex flex-col gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-full bg-card/95 backdrop-blur-sm shadow-lg"
            onClick={() => refetch()}
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-full bg-card/95 backdrop-blur-sm shadow-lg"
            onClick={centerOnUser}
          >
            <Navigation className="w-4 h-4" />
          </Button>
        </div>

        {/* Barra inferior de acciones rápidas */}
        <div className="absolute bottom-20 left-4 right-4">
          <div className="flex items-center justify-between gap-2">
            {/* Saldo */}
            <Button
              variant="outline"
              className="h-12 px-4 rounded-xl bg-card/95 backdrop-blur-sm shadow-lg flex items-center gap-2"
              onClick={() => setLocation("/wallet")}
            >
              <Wallet className="w-4 h-4 text-primary" />
              <span className="font-semibold">
                ${wallet?.balance ? parseInt(wallet.balance).toLocaleString() : "0"}
              </span>
            </Button>

            {/* Botón central QR */}
            <Button
              className="h-14 w-14 rounded-full gradient-primary shadow-glow"
              onClick={() => setLocation("/scan")}
            >
              <Zap className="w-6 h-6 text-white" />
            </Button>

            {/* Vehículo */}
            <Button
              variant="outline"
              className="h-12 px-4 rounded-xl bg-card/95 backdrop-blur-sm shadow-lg flex items-center gap-2"
              onClick={() => setLocation("/vehicles")}
            >
              <Car className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Vehículo</span>
            </Button>
          </div>
        </div>

        {/* Lista de estaciones (bottom sheet) */}
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              className="absolute bottom-36 left-1/2 -translate-x-1/2 h-8 px-4 rounded-full bg-card/95 backdrop-blur-sm shadow-lg text-sm"
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
                      <h4 className="font-semibold">{station.name}</h4>
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3" />
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
                    <div className="flex flex-col items-end">
                      <div className={`w-3 h-3 rounded-full ${
                        station.isOnline ? "status-available" : "status-faulted"
                      }`} />
                      <span className="text-xs text-muted-foreground mt-2">
                        2.3 km
                      </span>
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
                  <div>
                    <h4 className="font-semibold text-lg">{selectedStation.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {selectedStation.address}, {selectedStation.city}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full -mt-1 -mr-1"
                    onClick={() => setSelectedStation(null)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      getAvailableCount(selectedStation) > 0 ? "bg-primary" : "bg-muted"
                    }`} />
                    <span className="text-sm">
                      {getAvailableCount(selectedStation)} de {getTotalCount(selectedStation)} disponibles
                    </span>
                  </div>
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
