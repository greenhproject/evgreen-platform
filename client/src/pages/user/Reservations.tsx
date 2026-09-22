import { motion } from "framer-motion";
import { trpc } from "@/lib/trpc";
import UserLayout from "@/layouts/UserLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useState } from "react";
import { useLocation } from "wouter";
import { Calendar, Clock, MapPin, Zap, X, AlertTriangle, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function UserReservations() {
  const [, setLocation] = useLocation();
  const { data: reservations, isLoading, refetch } = trpc.reservations.myReservations.useQuery();
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<any>(null);

  const utils = trpc.useUtils();
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
      // Invalidar caches para que el EVSE vuelva a AVAILABLE
      utils.stations.listPublic.invalidate();
      utils.stations.getEvses.invalidate();
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
      SERVICE_UNAVAILABLE: "bg-amber-500/20 text-amber-300",
    };
    const labels: Record<string, string> = {
      ACTIVE: "Activa",
      FULFILLED: "Completada",
      EXPIRED: "Expirada",
      CANCELLED: "Cancelada",
      NO_SHOW: "No asistió",
      SERVICE_UNAVAILABLE: "Afectada por disponibilidad",
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
    
    if (hoursUntil >= 0.5) {
      return { percentage: 100, message: "Reembolso completo" };
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
            {/* Incidencias recientes: se separan del historial para que el usuario
                entienda que no fue un no-show ni una cancelación propia. */}
            {(() => {
              const recentIssueCutoff = Date.now() - 24 * 60 * 60 * 1000;
              const affected = (reservations || []).filter((r: any) => {
                const status = (r.reservationStatus || r.status || "").trim().toUpperCase();
                if (status !== "SERVICE_UNAVAILABLE") return false;
                const issueAt = new Date(r.serviceIssueAt || r.updatedAt || r.endTime).getTime();
                return Number.isFinite(issueAt) && issueAt >= recentIssueCutoff;
              });

              if (affected.length === 0) return null;

              return (
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-amber-300 flex items-center gap-1.5 uppercase tracking-wider">
                    <AlertTriangle className="h-4 w-4" />
                    Reserva afectada
                  </h3>
                  {affected.map((reservation: any) => (
                    <Card key={reservation.id} className="p-4 border-amber-500/50 bg-amber-500/10">
                      <div className="flex gap-3">
                        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold">{reservation.stationName || `Estación #${reservation.stationId}`}</p>
                              <p className="text-sm text-amber-100/85">
                                El conector seguía ocupado cuando inició tu reserva.
                              </p>
                            </div>
                            {getStatusBadge("SERVICE_UNAVAILABLE")}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            No se aplicará penalidad ni se registrará una no presentación. Nuestro equipo operativo fue informado.
                          </p>
                          <Button size="sm" className="w-full sm:w-auto" onClick={() => setLocation("/map")}>
                            <MapPin className="w-4 h-4 mr-1.5" />
                            Buscar otro conector
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              );
            })()}

{/* 1. Reservas En Curso / Listas para Cargar */}
            {(() => {
              const now = Date.now();
              const inProgress = (reservations || []).filter((r: any) => {
                const status = (r.reservationStatus || r.status || "").trim().toUpperCase();
                if (status !== "ACTIVE") return false;
                const start = new Date(r.startTime).getTime();
                const end = new Date(r.endTime).getTime();
                // En curso si ya empezó o faltan menos de 15 min y no ha terminado
                return (start - 15 * 60_000 <= now && end >= now);
              });

              if (inProgress.length === 0) return null;

              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                      </span>
                      Reservas activas / Listas para cargar
                    </h3>
                  </div>

                  {inProgress.map((reservation: any, index: number) => {
                    const stationName = reservation.stationName || reservation.station?.name || `Estación #${reservation.stationId}`;
                    const stationAddress = reservation.stationAddress || reservation.station?.address || "";
                    const targetCode = reservation.stationOcppIdentity || reservation.stationId;
                    return (
                      <motion.div
                        key={reservation.id}
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="rounded-2xl p-4 bg-gradient-to-br from-emerald-950/40 via-card/70 to-card/50 border-2 border-emerald-500/50 shadow-lg shadow-emerald-950/30 backdrop-blur"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <span className="inline-block px-2 py-0.5 mb-1.5 text-[10px] font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                              ⚡ Puesto asegurado
                            </span>
                            <h4 className="font-bold text-base text-foreground">{stationName}</h4>
                            {stationAddress && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3 h-3 text-muted-foreground" />
                                {stationAddress}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <Badge className="bg-emerald-500 text-black font-semibold hover:bg-emerald-400">
                              En Curso
                            </Badge>
                            <p className="text-[11px] text-emerald-400 mt-1 font-medium">
                              Hasta las {new Date(reservation.endTime).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs mb-3.5 p-2.5 rounded-xl bg-background/50 border border-emerald-500/20">
                          <div>
                            <span className="text-muted-foreground block text-[10px]">Horario acordado</span>
                            <span className="font-medium">
                              {new Date(reservation.startTime).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                              {" - "}
                              {new Date(reservation.endTime).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-[10px]">Conector</span>
                            <span className="font-medium text-emerald-300">
                              {reservation.connectorType?.replace("_", " ") || "Cargador"} • {reservation.powerKw || 7} kW
                            </span>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-bold h-10 shadow-md shadow-emerald-500/20"
                            onClick={() => setLocation(`/start-charge?code=${targetCode}`)}
                          >
                            <Zap className="w-4 h-4 mr-1.5 fill-current" />
                            Iniciar Carga Ahora
                          </Button>
                          <Button
                            variant="outline"
                            className="h-10 px-3 border-emerald-500/40 hover:bg-emerald-500/10 text-emerald-200"
                            onClick={() => {
                              if (reservation.stationLatitude && reservation.stationLongitude) {
                                window.open(`https://www.google.com/maps/dir/?api=1&destination=${reservation.stationLatitude},${reservation.stationLongitude}`, "_blank");
                              } else {
                                setLocation(`/station/${reservation.stationId}`);
                              }
                            }}
                          >
                            <Navigation className="w-4 h-4" />
                          </Button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              );
            })()}

            {/* 2. Próximas reservas (futuras, aún no inician) */}
            {(() => {
              const now = Date.now();
              const upcoming = (reservations || []).filter((r: any) => {
                const status = (r.reservationStatus || r.status || "").trim().toUpperCase();
                if (status !== "ACTIVE") return false;
                const start = new Date(r.startTime).getTime();
                // Futura si falta más de 15 minutos para que empiece
                return start - 15 * 60_000 > now;
              });

              if (upcoming.length === 0) return null;

              return (
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                    Próximas reservas
                  </h3>
                  {upcoming.map((reservation: any, index: number) => {
                    const stationName = reservation.stationName || reservation.station?.name || `Estación #${reservation.stationId}`;
                    const stationAddress = reservation.stationAddress || reservation.station?.address || "";
                    const targetCode = reservation.stationOcppIdentity || reservation.stationId;

                    return (
                      <motion.div
                        key={reservation.id}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Card className="p-4 bg-card/50 backdrop-blur border-primary/30">
                          <div className="flex items-start justify-between mb-3">
                            <div>
<h4 className="font-semibold">{stationName}</h4>
                              {stationAddress && (
                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {stationAddress}
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              {getStatusBadge(reservation.reservationStatus)}
                              <div className="text-xs text-primary mt-1 font-medium">
                                {getTimeUntilReservation(new Date(reservation.startTime))}
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
variant="outline"
                              className="flex-1 border-primary/40 hover:bg-primary/10"
                              onClick={() => setLocation(`/station/${reservation.stationId}`)}
                            >
                              <Navigation className="w-4 h-4 mr-1" />
                              Ver Estación
                            </Button>
                          </div>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Historial de reservas */}
            {reservations && reservations.filter(r => r.reservationStatus !== "ACTIVE").length > 0 && (
              <div className="space-y-3 mt-6">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                  Historial
                </h3>
                {reservations
                  // @ts-ignore
                  .filter(r => r.reservationStatus !== "ACTIVE")
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
                              {(reservation as any).stationName || "Estación"}
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
                          {getStatusBadge(reservation.reservationStatus)}
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
                  <div className="font-medium">{(selectedReservation as any).stationName || "Estación"}</div>
                  <div className="text-muted-foreground">
                    {selectedReservation.startTime.toLocaleDateString("es-CO", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                    {" a las "}
                    {selectedReservation.startTime.toLocaleTimeString("es-CO", {
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
                  <li>30 minutos o más antes: reembolso completo</li>
                  <li>Menos de 30 minutos antes: sin reembolso</li>
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
