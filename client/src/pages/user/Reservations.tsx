import { motion } from "framer-motion";
import { trpc } from "@/lib/trpc";
import UserLayout from "@/layouts/UserLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, MapPin, Zap, X } from "lucide-react";
import { toast } from "sonner";

export default function UserReservations() {
  const { data: reservations, isLoading, refetch } = trpc.reservations.myReservations.useQuery();

  const cancelMutation = trpc.reservations.cancel.useMutation({
    onSuccess: () => {
      toast.success("Reserva cancelada");
      refetch();
    },
    onError: () => {
      toast.error("Error al cancelar la reserva");
    },
  });

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      ACTIVE: "bg-primary/10 text-primary",
      FULFILLED: "bg-green-100 text-green-700",
      EXPIRED: "bg-gray-100 text-gray-700",
      CANCELLED: "bg-red-100 text-red-700",
      NO_SHOW: "bg-orange-100 text-orange-700",
    };
    const labels: Record<string, string> = {
      ACTIVE: "Activa",
      FULFILLED: "Completada",
      EXPIRED: "Expirada",
      CANCELLED: "Cancelada",
      NO_SHOW: "No asistió",
    };
    return <Badge className={styles[status]}>{labels[status] || status}</Badge>;
  };

  return (
    <UserLayout title="Mis reservas" showBack>
      <div className="p-4 space-y-4 pb-24">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-4 animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </Card>
            ))}
          </div>
        ) : reservations?.length === 0 ? (
          <Card className="p-8 text-center">
            <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Sin reservas</h3>
            <p className="text-muted-foreground text-sm">
              Reserva un cargador desde el mapa para asegurar tu puesto
            </p>
          </Card>
        ) : (
          reservations?.map((reservation, index) => (
            <motion.div
              key={reservation.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold">{(reservation as any).station?.name || "Estación"}</h4>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {(reservation as any).station?.address || "Dirección"}
                    </p>
                  </div>
                  {getStatusBadge(reservation.status)}
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span>
                      {new Date(reservation.startTime).toLocaleDateString("es-CO", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span>
                      {new Date(reservation.startTime).toLocaleTimeString("es-CO", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {" - "}
                      {new Date(reservation.endTime).toLocaleTimeString("es-CO", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                {reservation.status === "ACTIVE" && (
                  <div className="flex gap-2">
                    <Button className="flex-1 gradient-primary text-white">
                      <Zap className="w-4 h-4 mr-2" />
                      Iniciar carga
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => cancelMutation.mutate({ id: reservation.id })}
                      disabled={cancelMutation.isPending}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </Card>
            </motion.div>
          ))
        )}
      </div>
    </UserLayout>
  );
}
