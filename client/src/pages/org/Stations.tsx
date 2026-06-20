/**
 * Org Stations - Vista de estaciones de la organización SaaS
 * Muestra el estado en tiempo real de todas las estaciones asignadas
 */
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  MapPin,
  Search,
  CheckCircle,
  AlertCircle,
  Zap,
  WifiOff,
} from "lucide-react";
import { useState } from "react";

export default function OrgStations() {
  const [search, setSearch] = useState("");

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
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MapPin className="h-7 w-7 text-green-400" />
          Mis Estaciones
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Estado en tiempo real de las estaciones de carga de tu organización
        </p>
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

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, ciudad o dirección..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Stations Grid */}
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
    </div>
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
