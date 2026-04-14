/**
 * Mis Espacios - Aliado Comercial
 * Lista las estaciones de carga instaladas en los espacios del aliado
 */
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, MapPin, Zap, Wifi, WifiOff } from "lucide-react";

const financialTrpc = trpc.financial as any;

export default function HostSpaces() {
  const stationsQuery = financialTrpc.hostStations.useQuery();
  const stations = stationsQuery.data || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
          <Building2 className="h-5 w-5 sm:h-6 sm:w-6 text-amber-500" />
          Mis Espacios
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Estaciones de carga instaladas en tus ubicaciones
        </p>
      </div>

      {stationsQuery.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : stations.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No hay estaciones vinculadas</p>
          <p className="text-sm mt-1">Las estaciones aparecerán aquí cuando el administrador las asocie a tu cuenta</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stations.map((station: any) => (
            <Card key={station.id} className="border-amber-500/10 hover:border-amber-500/30 transition-colors">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                      <Zap className="h-6 w-6 text-amber-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{station.name}</h3>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3" />
                        {station.address || station.city || "Sin dirección"}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-[10px]">
                          Tu participación: {Number(station.hostSharePercent || 0).toFixed(1)}%
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          Costo energía: ${Number(station.energyCostPerKwh || 850).toLocaleString()}/kWh
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <Badge
                    variant={station.isOnline ? "default" : "destructive"}
                    className={station.isOnline ? "bg-emerald-500" : ""}
                  >
                    {station.isOnline ? (
                      <><Wifi className="h-3 w-3 mr-1" /> Online</>
                    ) : (
                      <><WifiOff className="h-3 w-3 mr-1" /> Offline</>
                    )}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
