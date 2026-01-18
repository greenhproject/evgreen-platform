import { motion } from "framer-motion";
import { trpc } from "@/lib/trpc";
import UserLayout from "@/layouts/UserLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useState } from "react";
import { Calendar, Clock, MapPin, Zap, X, AlertTriangle, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function UserReservations() {
  const { data: reservations, isLoading, refetch } = trpc.reservations.myReservations.useQuery();
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<any>(null);

  const cancelMutation = trpc.reservations.cancel.useMutation({
    onSuccess: (data) => {
      if (data.refundAmount && data.refundAmount > 0) {
        toast.success(`Reserva cancelada. Reembolso: $${data.refundAmount.toLocaleString()} COP`);
      } else {
        toast.success("Reserva cancelada");
      }
      setCancelDialogOpen(false);
      setSelectedReservation(null);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Error al cancelar la reserva");
    },
  });

  const handleCancelClick = (reservation: any) => {
    setSelectedReservation(reservation);
    setCancelDialogOpen(true);
  };

  const confirmCancel = () => {
    if (selectedReservation) {
      cancelMutation.mutate({ id: selectedReservation.id });
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      ACTIVE: "bg-primary/20 text-primary",
      FULFILLED: "bg-green-500/20 text-green-400",
      EXPIRED: "bg-gray-500/20 text-gray-400",
      CANCELLED: "bg-red-500/20 text-red-400",
      NO_SHOW: "bg-orange-500/20 text-orange-400",
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

  const getTimeUntilReservation = (startTime: Date) => {
    const now = new Date();
    const start = new Date(startTime);
    const diff = start.getTime() - now.getTime();
    
    if (diff < 0) return "En curso";
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `En ${days} día${days > 1 ? "s" : ""}`;
    }
    if (hours > 0) {
      return `En ${hours}h ${minutes}m`;
    }
    return `En ${minutes} min`;
  };

  const getRefundEstimate = (reservation: any) => {
    const now = new Date();
    const start = new Date(reservation.startTime);
    const hoursUntil = (start.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    if (hoursUntil >= 24) {
      return { percentage: 100, message: "Reembolso completo" };
    } else if (hoursUntil >= 2) {
      return { percentage: 50, message: "Reembolso parcial (50%)" };
    } else {
      return { percentage: 0, message: "Sin reembolso" };
    }
  };

  return (
    <UserLayout title="Mis reservas" showBack>
      <div className="p-4 space-y-4 pb-24">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-4 animate-pulse bg-card/50">
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </Card>
            ))}
          </div>
        ) : reservations?.length === 0 ? (
          <Card className="p-8 text-center bg-card/50 backdrop-blur border-border/50">
            <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Sin reservas</h3>
            <p className="text-muted-foreground text-sm">
              Reserva un cargador desde el mapa para asegurar tu puesto
            </p>
          </Card>
        ) : (
          <>
            {/* Reservas activas */}
            {reservations && reservations.filter(r => r.status === "ACTIVE").length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                  Próximas reservas
                </h3>
                {reservations
                  .filter(r => r.status === "ACTIVE")
                  .map((reservation, index) => {
                    const refundInfo = getRefundEstimate(reservation);
                    return (
                      <motion.div
                        key={reservation.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Card className="p-4 bg-card/50 backdrop-blur border-primary/30">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h4 className="font-semibold">{(reservation as any).station?.name || "Estación"}</h4>
                              <p className="text-sm text-muted-foreground flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {(reservation as any).station?.address || "Dirección"}
                              </p>
                            </div>
                            <div className="text-right">
                              {getStatusBadge(reservation.status)}
                              <div className="text-xs text-primary mt-1 font-medium">
                                {getTimeUntilReservation(reservation.startTime)}
                              </div>
                            </div>
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

                          {reservation.reservationFee && (
                            <div className="flex items-center justify-between text-sm mb-4 p-2 bg-muted/30 rounded-lg">
                              <span className="text-muted-foreground">Tarifa de reserva</span>
                              <span className="font-semibold">${Number(reservation.reservationFee).toLocaleString()} COP</span>
                            </div>
                          )}

                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/10"
                              onClick={() => handleCancelClick(reservation)}
                            >
                              <X className="w-4 h-4 mr-1" />
                              Cancelar
                            </Button>
                            <Button
                              size="sm"
                              className="flex-1 gradient-primary text-white"
                            >
                              <Navigation className="w-4 h-4 mr-1" />
                              Ir a estación
                            </Button>
                          </div>
                        </Card>
                      </motion.div>
                    );
                  })}
              </div>
            )}

            {/* Historial de reservas */}
            {reservations && reservations.filter(r => r.status !== "ACTIVE").length > 0 && (
              <div className="space-y-3 mt-6">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                  Historial
                </h3>
                {reservations
                  .filter(r => r.status !== "ACTIVE")
                  .map((reservation, index) => (
                    <motion.div
                      key={reservation.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card className="p-4 bg-card/30 backdrop-blur border-border/30">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium text-muted-foreground">
                              {(reservation as any).station?.name || "Estación"}
                            </h4>
                            <p className="text-sm text-muted-foreground/70 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(reservation.startTime).toLocaleDateString("es-CO", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </p>
                          </div>
                          {getStatusBadge(reservation.status)}
                        </div>
                      </Card>
                    </motion.div>
                  ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Dialog de confirmación de cancelación */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="max-w-sm bg-background/95 backdrop-blur border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-400" />
              Cancelar Reserva
            </DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas cancelar esta reserva?
            </DialogDescription>
          </DialogHeader>

          {selectedReservation && (
            <div className="py-4 space-y-4">
              <Card className="p-3 bg-muted/30">
                <div className="text-sm">
                  <div className="font-medium">{(selectedReservation as any).station?.name}</div>
                  <div className="text-muted-foreground">
                    {new Date(selectedReservation.startTime).toLocaleDateString("es-CO", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                    {" a las "}
                    {new Date(selectedReservation.startTime).toLocaleTimeString("es-CO", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </Card>

              <Card className={`p-3 ${
                getRefundEstimate(selectedReservation).percentage === 100 ? "bg-green-500/10 border-green-500/30" :
                getRefundEstimate(selectedReservation).percentage === 50 ? "bg-yellow-500/10 border-yellow-500/30" :
                "bg-red-500/10 border-red-500/30"
              }`}>
                <div className="flex items-center gap-2">
                  {getRefundEstimate(selectedReservation).percentage === 100 ? (
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                  ) : getRefundEstimate(selectedReservation).percentage === 50 ? (
                    <AlertTriangle className="w-5 h-5 text-yellow-400" />
                  ) : (
                    <X className="w-5 h-5 text-red-400" />
                  )}
                  <div>
                    <div className="font-medium">{getRefundEstimate(selectedReservation).message}</div>
                    {selectedReservation.reservationFee && (
                      <div className="text-sm text-muted-foreground">
                        Reembolso: ${Math.round(Number(selectedReservation.reservationFee) * getRefundEstimate(selectedReservation).percentage / 100).toLocaleString()} COP
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              <div className="text-xs text-muted-foreground">
                <p>Política de cancelación:</p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Más de 24h antes: reembolso completo</li>
                  <li>Entre 2-24h antes: reembolso del 50%</li>
                  <li>Menos de 2h antes: sin reembolso</li>
                </ul>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setCancelDialogOpen(false)}
            >
              Volver
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={confirmCancel}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <X className="w-4 h-4 mr-2" />
              )}
              Confirmar Cancelación
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </UserLayout>
  );
}

// Navigation icon component
function Navigation({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="3 11 22 2 13 21 11 13 3 11" />
    </svg>
  );
}
