import { useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import { trpc } from "@/lib/trpc";
import UserLayout from "@/layouts/UserLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MapPin,
  Clock,
  Zap,
  Navigation,
  Phone,
  Calendar,
  ChevronRight,
  Star,
  Info
} from "lucide-react";
import { toast } from "sonner";

export default function StationDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();

  const { data: station, isLoading } = trpc.stations.getById.useQuery({ 
    id: parseInt(id || "0") 
  });
  
  // Obtener EVSEs de la estación
  const { data: evses } = trpc.stations.getEvses.useQuery(
    { stationId: parseInt(id || "0") },
    { enabled: !!station }
  );

  const getConnectorStatus = (status: string) => {
    const styles: Record<string, { bg: string; text: string; label: string }> = {
      AVAILABLE: { bg: "bg-green-100", text: "text-green-700", label: "Disponible" },
      CHARGING: { bg: "bg-blue-100", text: "text-blue-700", label: "Cargando" },
      PREPARING: { bg: "bg-yellow-100", text: "text-yellow-700", label: "Preparando" },
      RESERVED: { bg: "bg-purple-100", text: "text-purple-700", label: "Reservado" },
      FAULTED: { bg: "bg-red-100", text: "text-red-700", label: "Falla" },
      UNAVAILABLE: { bg: "bg-gray-100", text: "text-gray-700", label: "No disponible" },
    };
    return styles[status] || styles.UNAVAILABLE;
  };

  if (isLoading) {
    return (
      <UserLayout title="Cargando..." showBack>
        <div className="p-4 space-y-4">
          <Card className="h-48 animate-pulse bg-muted" />
          <Card className="h-32 animate-pulse bg-muted" />
        </div>
      </UserLayout>
    );
  }

  if (!station) {
    return (
      <UserLayout title="Estación no encontrada" showBack>
        <div className="p-4 text-center py-12">
          <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Esta estación no existe</p>
        </div>
      </UserLayout>
    );
  }

  const availableCount = evses?.filter((e: any) => e.status === "AVAILABLE").length || 0;

  return (
    <UserLayout title={station.name} showBack>
      <div className="pb-32">
        {/* Imagen/Mapa de la estación */}
        <div className="h-48 bg-gradient-to-br from-primary/20 to-secondary/20 relative">
          <div className="absolute inset-0 flex items-center justify-center">
            <Zap className="w-16 h-16 text-primary/30" />
          </div>
          <div className="absolute bottom-4 left-4 right-4">
            <Badge className={availableCount > 0 ? "bg-primary" : "bg-muted"}>
              {availableCount} disponibles
            </Badge>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Info básica */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="p-4">
              <h2 className="text-xl font-bold mb-2">{station.name}</h2>
              <p className="text-muted-foreground flex items-center gap-2 mb-4">
                <MapPin className="w-4 h-4" />
                {station.address}, {station.city}
              </p>
              
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span>{(station as any).operatingHours || "24/7"}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-500" />
                  <span>4.8</span>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Conectores */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h3 className="font-semibold mb-3">Conectores disponibles</h3>
            <div className="space-y-3">
              {evses?.map((evse: any, index: number) => {
                const statusStyle = getConnectorStatus(evse.status);
                return (
                  <Card key={evse.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl ${statusStyle.bg} flex items-center justify-center`}>
                          <Zap className={`w-6 h-6 ${statusStyle.text}`} />
                        </div>
                        <div>
                          <div className="font-medium">Conector {index + 1}</div>
                          <div className="text-sm text-muted-foreground">
                            {evse.connectorType?.replace("_", " ")} • {evse.powerKw} kW
                          </div>
                        </div>
                      </div>
                      <Badge className={`${statusStyle.bg} ${statusStyle.text}`}>
                        {statusStyle.label}
                      </Badge>
                    </div>
                    
                    {evse.status === "AVAILABLE" && (
                      <div className="mt-4 flex gap-2">
                        <Button
                          className="flex-1 gradient-primary text-white"
                          onClick={() => setLocation(`/charging/${evse.id}`)}
                        >
                          <Zap className="w-4 h-4 mr-2" />
                          Iniciar carga
                        </Button>
                        <Button variant="outline">
                          <Calendar className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </motion.div>

          {/* Tarifas */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h3 className="font-semibold mb-3">Tarifas</h3>
            <Card className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Precio por kWh</span>
                  <span className="font-semibold">$800 COP</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Tarifa de conexión</span>
                  <span className="font-semibold">$2,000 COP</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Penalización por ocupación</span>
                  <span className="font-semibold">$500 COP/min</span>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Información adicional */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div className="text-sm text-muted-foreground">
                  {station.description || "Estación de carga operada por Green EV. Disponible las 24 horas del día, los 7 días de la semana."}
                </div>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Botones fijos */}
        <div className="fixed bottom-20 left-4 right-4 flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              window.open(
                `https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}`,
                "_blank"
              );
            }}
          >
            <Navigation className="w-4 h-4 mr-2" />
            Cómo llegar
          </Button>
          <Button
            variant="outline"
            onClick={() => window.open("tel:+573001234567")}
          >
            <Phone className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </UserLayout>
  );
}
