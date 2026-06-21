/**
 * Org Stations - Vista de estaciones de la organización SaaS
 * Muestra el estado en tiempo real + mapa de ubicaciones
 */
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  Search,
  CheckCircle,
  AlertCircle,
  Zap,
  WifiOff,
  Map,
  List,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { MapView } from "@/components/Map";

export default function OrgStations() {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "map">("list");
  const [selectedStation, setSelectedStation] = useState<any>(null);

  const { data: stations, isLoading } = (trpc.organizations as any).getMyStations.useQuery();

  const filtered = stations?.filter((s: any) =>
    !search ||
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.city?.toLowerCase().includes(search.toLowerCase()) ||
    s.address?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const onlineCount = stations?.filter((s: any) => s.isOnline).length || 0;
  const offlineCount = stations?.filter((s: any) => !s.isOnline).length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MapPin className="h-7 w-7 text-green-400" />
            Mis Estaciones
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Estado en tiempo real de las estaciones de carga de tu organización
          </p>
        </div>
        {/* View toggle */}
        <div className="flex gap-1 bg-muted rounded-lg p-1 self-start">
          <button
            onClick={() => setView("list")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              view === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <List className="h-3.5 w-3.5" />
            Lista
          </button>
          <button
            onClick={() => setView("map")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              view === "map" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Map className="h-3.5 w-3.5" />
            Mapa
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-4 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
          <CheckCircle className="h-4 w-4 text-green-400" />
          <span className="text-sm font-medium text-green-400">{onlineCount} en línea</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
          <AlertCircle className="h-4 w-4 text-red-400" />
          <span className="text-sm font-medium text-red-400">{offlineCount} fuera de línea</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted border border-border/50">
          <Zap className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">{stations?.length || 0} total</span>
        </div>
      </div>

      {/* Search (only in list view) */}
      {view === "list" && (
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, ciudad o dirección..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {/* Map View */}
      {view === "map" && (
        <Card className="border-border/50 overflow-hidden">
          <div className="h-[500px] relative">
            {isLoading ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Cargando mapa...
              </div>
            ) : !stations || stations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
                <MapPin className="h-12 w-12 opacity-30" />
                <p>No hay estaciones para mostrar en el mapa</p>
              </div>
            ) : (
              <OrgStationsMap
                stations={stations}
                selectedStation={selectedStation}
                onSelectStation={setSelectedStation}
              />
            )}
          </div>
          {/* Station detail panel */}
          {selectedStation && (
            <CardContent className="py-3 border-t border-border/50">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold">{selectedStation.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedStation.address || selectedStation.city || "Sin dirección"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                    selectedStation.isOnline ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${selectedStation.isOnline ? "bg-green-400" : "bg-red-400"}`} />
                    {selectedStation.isOnline ? "Online" : "Offline"}
                  </div>
                  {selectedStation.maxPowerKw && (
                    <Badge variant="outline" className="text-xs">
                      {selectedStation.maxPowerKw} kW
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={() => setSelectedStation(null)}
                  >
                    ✕
                  </Button>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* List View */}
      {view === "list" && (
        <>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              Cargando estaciones...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MapPin className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>{search ? "No se encontraron estaciones con ese criterio" : "No hay estaciones asignadas a tu organización"}</p>
              {!search && (
                <p className="text-sm mt-1">Contacta al administrador de EVGreen para asignar estaciones.</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((s: any) => (
                <StationCard key={s.id} station={s} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function OrgStationsMap({
  stations,
  selectedStation,
  onSelectStation,
}: {
  stations: any[];
  selectedStation: any;
  onSelectStation: (s: any) => void;
}) {
  const markersRef = useRef<any[]>([]);

  const handleMapReady = (map: google.maps.Map) => {
    const bounds = new google.maps.LatLngBounds();
    let hasValidCoords = false;

    // Clear previous markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    stations.forEach((station) => {
      const lat = parseFloat(station.latitude);
      const lng = parseFloat(station.longitude);
      if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;

      hasValidCoords = true;
      const position = { lat, lng };
      bounds.extend(position);

      const isOnline = station.isOnline;

      const marker = new google.maps.Marker({
        position,
        map,
        title: station.name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: isOnline ? "#22c55e" : "#ef4444",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
        },
      });

      marker.addListener("click", () => {
        onSelectStation(station);
        map.panTo(position);
      });

      markersRef.current.push(marker);
    });

    if (hasValidCoords) {
      map.fitBounds(bounds);
      if (stations.length === 1) map.setZoom(15);
    } else {
      // Default: Colombia center
      map.setCenter({ lat: 4.711, lng: -74.0721 });
      map.setZoom(6);
    }
  };

  return (
    <MapView
      onMapReady={handleMapReady}
      className="w-full h-full"
      initialCenter={{ lat: 4.711, lng: -74.0721 }}
      initialZoom={6}
    />
  );
}

function StationCard({ station }: { station: any }) {
  const isOnline = station.isOnline;

  return (
    <Card className={`border-border/50 transition-all ${isOnline ? "hover:border-green-500/30" : "opacity-80"}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{station.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{station.city || station.address || "Sin ubicación"}</span>
            </p>
          </div>
          <div className={`flex items-center gap-1 shrink-0 px-2 py-1 rounded-full text-xs font-medium ${
            isOnline
              ? "bg-green-500/10 text-green-400"
              : "bg-red-500/10 text-red-400"
          }`}>
            {isOnline ? (
              <CheckCircle className="h-3 w-3" />
            ) : (
              <WifiOff className="h-3 w-3" />
            )}
            {isOnline ? "Online" : "Offline"}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          {station.address && (
            <div className="col-span-2">
              <p className="text-muted-foreground">Dirección</p>
              <p className="font-medium truncate">{station.address}</p>
            </div>
          )}
          {station.ocppId && (
            <div>
              <p className="text-muted-foreground">OCPP ID</p>
              <p className="font-medium font-mono">{station.ocppId}</p>
            </div>
          )}
          {station.maxPowerKw && (
            <div>
              <p className="text-muted-foreground">Potencia Máx.</p>
              <p className="font-medium">{station.maxPowerKw} kW</p>
            </div>
          )}
        </div>

        {!isOnline && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-red-400 bg-red-500/10 rounded-lg px-2.5 py-1.5">
            <WifiOff className="h-3 w-3 shrink-0" />
            <span>Estación desconectada del servidor OCPP</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
