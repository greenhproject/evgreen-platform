import { useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";
import UserLayout from "@/layouts/UserLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useMemo } from "react";
import {
  MapPin,
  Clock,
  Zap,
  Navigation,
  Phone,
  Calendar,
  ChevronRight,
  Star,
  Info,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Ban,
} from "lucide-react";
import { toast } from "sonner";
import { AIInsightCard } from "@/components/AIInsightCard";
import { useAuth } from "@/_core/hooks/useAuth";

// Componente de tarifa dinámica del kWh
function DynamicPricingCard({ stationId }: { stationId: number }) {
  const { data: kwhPrice, isLoading } = trpc.transactions.getDynamicKwhPrice.useQuery(
    { stationId },
    { refetchInterval: 60000 } // Actualizar cada minuto
  );

  const getDemandColor = (level: string) => {
    switch (level) {
      case "LOW": return "text-green-400";
      case "NORMAL": return "text-blue-400";
      case "HIGH": return "text-orange-400";
      case "SURGE": return "text-red-400";
      default: return "text-muted-foreground";
    }
  };

  const getDemandBg = (level: string) => {
    switch (level) {
      case "LOW": return "bg-green-500/10 border-green-500/30";
      case "NORMAL": return "bg-blue-500/10 border-blue-500/30";
      case "HIGH": return "bg-orange-500/10 border-orange-500/30";
      case "SURGE": return "bg-red-500/10 border-red-500/30";
      default: return "bg-muted";
    }
  };

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h3 className="font-semibold mb-3">Tarifas</h3>
        <Card className="p-4 bg-card/50 backdrop-blur border-border/50 animate-pulse">
          <div className="h-32" />
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <h3 className="font-semibold mb-3 flex items-center gap-2">
        Tarifas en tiempo real
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
        </span>
      </h3>
      <Card className={`p-4 backdrop-blur border-2 ${kwhPrice ? getDemandBg(kwhPrice.factors.demandLevel) : 'bg-card/50 border-border/50'}`}>
        <div className="space-y-4">
          {/* Precio dinámico principal */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Precio actual por kWh</div>
              <div className="flex items-baseline gap-2">
                <span className={`text-3xl font-bold ${kwhPrice ? getDemandColor(kwhPrice.factors.demandLevel) : ''}`}>
                  ${kwhPrice?.dynamicPricePerKwh?.toLocaleString() || '---'}
                </span>
                <span className="text-muted-foreground">COP</span>
              </div>
            </div>
            {kwhPrice && (
              <div className="text-right">
                <div className={`text-sm font-medium ${getDemandColor(kwhPrice.factors.demandLevel)}`}>
                  {kwhPrice.demandVisualization?.message}
                </div>
                <div className={`text-lg font-bold ${getDemandColor(kwhPrice.factors.demandLevel)}`}>
                  {kwhPrice.demandVisualization?.savingsOrSurge}
                </div>
              </div>
            )}
          </div>

          {/* Comparación con precio base */}
          {kwhPrice && kwhPrice.multiplier !== 1 && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Precio base:</span>
              <span className="line-through text-muted-foreground">
                ${kwhPrice.basePricePerKwh?.toLocaleString()} COP
              </span>
              <span className={getDemandColor(kwhPrice.factors.demandLevel)}>
                ({kwhPrice.multiplier > 1 ? '+' : ''}{Math.round((kwhPrice.multiplier - 1) * 100)}%)
              </span>
            </div>
          )}

          {/* Descuento de suscripción */}
          {kwhPrice && (kwhPrice as any).subscriptionDiscount > 0 && (
            <div className="flex items-center gap-2 text-sm text-green-400">
              <span>Descuento suscripción: -{(kwhPrice as any).subscriptionDiscount}%</span>
              <span className="line-through text-muted-foreground text-xs">
                ${(kwhPrice as any).priceBeforeDiscount?.toLocaleString()}
              </span>
            </div>
          )}

          {/* Detalles de factores */}
          {kwhPrice && (
            <div className="pt-3 border-t border-border/50 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Tarifa de conexión</span>
                <span className="font-medium">$2,000 COP</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Penalización por ocupación</span>
                <span className="font-medium">$500 COP/min</span>
              </div>
            </div>
          )}

          {/* Indicador de validez */}
          {kwhPrice && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
              <Info className="w-3 h-3" />
              <span>Precio válido por 15 min. Actualiza automáticamente.</span>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

export default function StationDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [selectedEvse, setSelectedEvse] = useState<any>(null);
  const [reservationDate, setReservationDate] = useState("");
  const [reservationTime, setReservationTime] = useState("");
  const [estimatedDuration, setEstimatedDuration] = useState("60");
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [newRating, setNewRating] = useState(0);
  const [newComment, setNewComment] = useState("");

  const stationId = parseInt(id || "0");
  const { user } = useAuth();

  const { data: station, isLoading } = trpc.stations.getById.useQuery({ 
    id: stationId 
  });
  
  // Obtener EVSEs de la estación
  const { data: evses } = trpc.stations.getEvses.useQuery(
    { stationId },
    { enabled: !!station }
  );

  // Obtener mis reservas activas para esta estación
  const { data: myReservations } = trpc.reservations.myReservations.useQuery(
    undefined,
    { enabled: !!user }
  );

  // Mutación para cancelar reserva
  const cancelReservation = trpc.reservations.cancel.useMutation({
    onSuccess: (data) => {
      if (data.refundAmount && data.refundAmount > 0) {
        toast.success(`Reserva cancelada. Reembolso: $${data.refundAmount.toLocaleString()} COP`);
      } else {
        toast.success("Reserva cancelada exitosamente");
      }
      utils.stations.listPublic.invalidate();
      utils.stations.getEvses.invalidate();
      utils.reservations.myReservations.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Error al cancelar la reserva");
    },
  });

  // Obtener calificaciones reales de la estación
  const { data: reviewsData } = trpc.reviews.getByStation.useQuery(
    { stationId },
    { enabled: !!station }
  );

  const stationRating = reviewsData?.averageRating ?? null;
  const totalReviews = reviewsData?.totalReviews ?? 0;

  // Obtener tarifa dinámica
  const requestedDate = useMemo(() => {
    if (reservationDate && reservationTime) {
      return new Date(`${reservationDate}T${reservationTime}`);
    }
    return new Date();
  }, [reservationDate, reservationTime]);

  const { data: dynamicPrice, isLoading: priceLoading } = trpc.reservations.getDynamicPrice.useQuery(
    {
      stationId,
      evseId: selectedEvse?.id || 1,
      requestedDate,
      estimatedDurationMinutes: parseInt(estimatedDuration),
    },
    { enabled: !!selectedEvse && showReservationModal }
  );

  // Obtener predicción de mejores horarios
  const { data: bestTimes } = trpc.reservations.getBestTimes.useQuery(
    { stationId },
    { enabled: showReservationModal }
  );

  // Obtener ocupación de la zona
  const { data: occupancy } = trpc.reservations.getZoneOccupancy.useQuery(
    { stationId },
    { enabled: !!station }
  );

  // Obtener precio dinámico actual para pasar a la sugerencia de IA
  const { data: currentKwhPrice } = trpc.transactions.getDynamicKwhPrice.useQuery(
    { stationId },
    { enabled: !!station, refetchInterval: 60000 }
  );

  // Mutación para crear review
  const utils = trpc.useUtils();
  const { data: debtInfo } = trpc.debts.myDebts.useQuery();
  const submitReview = trpc.reviews.create.useMutation({
    onSuccess: () => {
      toast.success("¡Gracias por tu calificación!");
      setShowReviewForm(false);
      setNewRating(0);
      setNewComment("");
      utils.reviews.getByStation.invalidate({ stationId });
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al enviar calificación");
    },
  });

  const handleSubmitReview = () => {
    if (newRating === 0) {
      toast.error("Selecciona una calificación");
      return;
    }
    submitReview.mutate({
      stationId,
      rating: newRating,
      comment: newComment || undefined,
    });
  };

  // Mutación para crear reserva
  const createReservation = trpc.reservations.create.useMutation({
    onSuccess: (data) => {
      toast.success(`Reserva creada exitosamente. Tarifa: $${data.reservationFee.toLocaleString()} COP`);
      setShowReservationModal(false);
      setSelectedEvse(null);
      // Invalidar caches para que el estado RESERVED se refleje inmediatamente
      utils.stations.listPublic.invalidate();
      utils.stations.getEvses.invalidate();
      utils.reservations.myReservations.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleReserve = (evse: any) => {
    setSelectedEvse(evse);
    // Establecer fecha y hora por defecto (próxima hora)
    const now = new Date();
    now.setHours(now.getHours() + 1, 0, 0, 0);
    setReservationDate(now.toISOString().split("T")[0]);
    setReservationTime(now.toTimeString().slice(0, 5));
    setShowReservationModal(true);
  };

  const handleConfirmReservation = () => {
    if (!selectedEvse || !reservationDate || !reservationTime) {
      toast.error("Por favor completa todos los campos");
      return;
    }

    const startTime = new Date(`${reservationDate}T${reservationTime}`);
    const endTime = new Date(startTime.getTime() + parseInt(estimatedDuration) * 60 * 1000);

    createReservation.mutate({
      evseId: selectedEvse.id,
      stationId,
      startTime,
      endTime,
      estimatedDurationMinutes: parseInt(estimatedDuration),
    });
  };

  const getConnectorStatus = (status: string) => {
    const styles: Record<string, { bg: string; text: string; label: string }> = {
      AVAILABLE: { bg: "bg-green-500/20", text: "text-green-400", label: "Disponible" },
      CHARGING: { bg: "bg-red-500/20", text: "text-red-400", label: "Ocupado" },
      PREPARING: { bg: "bg-red-500/20", text: "text-red-400", label: "Ocupado" },
      SUSPENDED_EV: { bg: "bg-red-500/20", text: "text-red-400", label: "Ocupado" },
      SUSPENDED_EVSE: { bg: "bg-red-500/20", text: "text-red-400", label: "Ocupado" },
      FINISHING: { bg: "bg-red-500/20", text: "text-red-400", label: "Ocupado" },
      RESERVED: { bg: "bg-purple-500/20", text: "text-purple-400", label: "Reservado" },
      FAULTED: { bg: "bg-red-500/20", text: "text-red-400", label: "Falla" },
      UNAVAILABLE: { bg: "bg-gray-500/20", text: "text-gray-400", label: "No disponible" },
    };
    return styles[status] || styles.UNAVAILABLE;
  };

  const getDemandIcon = (level: string) => {
    switch (level) {
      case "LOW": return <TrendingDown className="w-5 h-5" />;
      case "NORMAL": return <Minus className="w-5 h-5" />;
      case "HIGH": return <TrendingUp className="w-5 h-5" />;
      case "SURGE": return <AlertTriangle className="w-5 h-5" />;
      default: return <Minus className="w-5 h-5" />;
    }
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
        {/* Imagen/Header de la estación */}
        <div className="relative overflow-hidden" style={{ minHeight: station.imageUrl ? '220px' : '180px' }}>
          {station.imageUrl ? (
            <>
              <img 
                src={station.imageUrl} 
                alt={station.name}
                className="w-full h-56 object-cover"
              />
              {/* Overlay gradiente para legibilidad */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            </>
          ) : (
            <div className="h-48 bg-gradient-to-br from-primary/20 via-emerald-900/30 to-secondary/20">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/10 blur-3xl rounded-full w-32 h-32 -translate-x-1/2 -translate-y-1/2" />
                  <Zap className="w-16 h-16 text-primary/30" />
                </div>
              </div>
            </div>
          )}
          {/* Badges sobre la imagen */}
          <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
            <Badge className={`${availableCount > 0 ? "bg-primary" : "bg-muted"} shadow-lg`}>
              {availableCount} disponibles
            </Badge>
            <div className="flex gap-2">
              {occupancy && (
                <Badge 
                  variant="outline" 
                  className={`backdrop-blur-sm bg-black/30 shadow-lg
                    ${occupancy.occupancyRate < 30 ? "border-green-500 text-green-400" : ""}
                    ${occupancy.occupancyRate >= 30 && occupancy.occupancyRate < 70 ? "border-blue-500 text-blue-400" : ""}
                    ${occupancy.occupancyRate >= 70 ? "border-orange-500 text-orange-400" : ""}
                  `}
                >
                  {Math.round(occupancy.occupancyRate)}% ocupación
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Info básica */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="p-4 bg-card/50 backdrop-blur border-border/50">
              <h2 className="text-xl font-bold mb-2">{station.name}</h2>
              <p className="text-muted-foreground flex items-center gap-2 mb-4">
                <MapPin className="w-4 h-4" />
                {station.address}, {station.city}
              </p>
              
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span>
                    {(() => {
                      const oh = (station as any).operatingHours;
                      if (!oh || (typeof oh === 'object' && Object.keys(oh).length === 0)) return 'Horario no configurado';
                      if (typeof oh === 'string') return oh;
                      const days = Object.values(oh) as any[];
                      const is24_7 = days.length === 7 && days.every((d: any) => d?.open === '00:00' && d?.close === '23:59');
                      if (is24_7) return '24/7';
                      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                      const today = dayNames[new Date().getDay()];
                      const todayHours = (oh as any)[today];
                      if (todayHours?.closed) return 'Cerrado hoy';
                      return todayHours ? `Hoy: ${todayHours.open} - ${todayHours.close}` : 'Horario no configurado';
                    })()}
                  </span>
                </div>
                {stationRating !== null && (
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    <span>{stationRating.toFixed(1)}</span>
                    <span className="text-muted-foreground">({totalReviews})</span>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>

          {/* Indicador de demanda en tiempo real */}
          {occupancy && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
            >
              <Card className={`p-4 border-2 ${
                occupancy.occupancyRate < 30 ? "border-green-500/50 bg-green-500/10" :
                occupancy.occupancyRate < 70 ? "border-blue-500/50 bg-blue-500/10" :
                occupancy.occupancyRate < 90 ? "border-orange-500/50 bg-orange-500/10" :
                "border-red-500/50 bg-red-500/10"
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {occupancy.occupancyRate < 30 ? (
                      <TrendingDown className="w-6 h-6 text-green-400" />
                    ) : occupancy.occupancyRate < 70 ? (
                      <Minus className="w-6 h-6 text-blue-400" />
                    ) : occupancy.occupancyRate < 90 ? (
                      <TrendingUp className="w-6 h-6 text-orange-400" />
                    ) : (
                      <AlertTriangle className="w-6 h-6 text-red-400" />
                    )}
                    <div>
                      <div className="font-semibold">
                        {occupancy.occupancyRate < 30 ? "Baja demanda" :
                         occupancy.occupancyRate < 70 ? "Demanda normal" :
                         occupancy.occupancyRate < 90 ? "Alta demanda" :
                         "Demanda muy alta"}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {occupancy.availableConnectors} de {occupancy.totalConnectors} conectores libres
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-bold ${
                      occupancy.occupancyRate < 30 ? "text-green-400" :
                      occupancy.occupancyRate < 70 ? "text-blue-400" :
                      occupancy.occupancyRate < 90 ? "text-orange-400" :
                      "text-red-400"
                    }`}>
                      {occupancy.occupancyRate < 30 ? "Ahorra 20%" :
                       occupancy.occupancyRate < 70 ? "Precio normal" :
                       occupancy.occupancyRate < 90 ? "+40% surge" :
                       "+100% surge"}
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Conectores */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Conectores disponibles</h3>
              {station.isOnline === false && (
                <span className="text-xs text-orange-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Sin conexión
                </span>
              )}
            </div>
            {/* Banner offline */}
            {station.isOnline === false && (
              <div className="mb-3 p-3 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-orange-400">Estación sin conexión</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    El cargador no está conectado al servidor en este momento. No es posible iniciar una carga. Inténtalo más tarde.
                  </div>
                </div>
              </div>
            )}
            <div className="space-y-3">
              {evses?.map((evse: any, index: number) => {
                const statusStyle = getConnectorStatus(evse.status);
                return (
                  <Card key={evse.id} className="p-4 bg-card/50 backdrop-blur border-border/50">
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
                      <div className="mt-3 space-y-2">
                        {/* Mostrar info de reserva futura si existe */}
                        {(evse as any).nextReservation && (() => {
                          const nextRes = (evse as any).nextReservation;
                          const isMyNextRes = user?.id && String(nextRes.userId) === String(user.id);
                          const myNextResDetail = myReservations?.find((r: any) => r.id === nextRes.id);
                          return (
                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                              <div className="flex items-center gap-2 text-blue-400 text-xs font-medium mb-1">
                                <Calendar className="w-3 h-3" />
                                {isMyNextRes ? "Tu pr\u00f3xima reserva" : "Reserva programada"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(nextRes.startTime).toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" })}
                                {" a las "}
                                {new Date(nextRes.startTime).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                                {" - "}
                                {new Date(nextRes.endTime).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                              </div>
                              {isMyNextRes && myNextResDetail?.reservationFee && (
                                <div className="text-xs text-blue-300 mt-1">Tarifa: ${Number(myNextResDetail.reservationFee).toLocaleString()} COP</div>
                              )}
                              {isMyNextRes && (() => {
                                const minutesUntilStart = (new Date(nextRes.startTime).getTime() - Date.now()) / (1000 * 60);
                                const hasRefund = minutesUntilStart >= 30;
                                return (
                                  <div className="mt-2 flex items-center gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/10 text-xs h-7"
                                      onClick={() => {
                                        const msg = hasRefund
                                          ? `\u00bfCancelar esta reserva? Se te reembolsar\u00e1 el 100% ($${Number(myNextResDetail?.reservationFee || 0).toLocaleString()} COP) por cancelar con m\u00e1s de 30 minutos de anticipaci\u00f3n.`
                                          : `\u00bfCancelar esta reserva? No habr\u00e1 reembolso porque faltan menos de 30 minutos para el inicio.`;
                                        if (confirm(msg)) {
                                          cancelReservation.mutate({ id: nextRes.id });
                                        }
                                      }}
                                      disabled={cancelReservation.isPending}
                                    >
                                      {cancelReservation.isPending ? (
                                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                      ) : null}
                                      Cancelar reserva
                                    </Button>
                                    <span className={`text-[10px] ${hasRefund ? 'text-green-400' : 'text-red-400'}`}>
                                      {hasRefund ? 'Reembolso 100%' : 'Sin reembolso'}
                                    </span>
                                  </div>
                                );
                              })()}
                            </div>
                          );
                        })()}
                        {/* Verificar deuda pendiente */}
                        {debtInfo?.hasDebt ? (
                          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                            <div className="flex items-center gap-2 mb-1">
                              <Ban className="w-4 h-4 text-red-400" />
                              <span className="text-xs font-bold text-red-400">Cargas bloqueadas</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground mb-2">
                              Tienes una deuda de ${debtInfo.totalDebt.toLocaleString()} COP. Paga en Billetera para continuar.
                            </p>
                            <Button
                              size="sm"
                              className="w-full bg-red-500 hover:bg-red-600 text-white text-xs h-8"
                              onClick={() => setLocation('/wallet')}
                            >
                              Ir a Billetera
                            </Button>
                          </div>
                        ) : (
                        <div className="flex gap-2">
                          <Button
                            className="flex-1 gradient-primary text-white"
                            onClick={() => setLocation(`/start-charge?code=${station.ocppIdentity || station.id}`)}
                            disabled={station.isOnline === false}
                          >
                            <Zap className="w-4 h-4 mr-2" />
                            {station.isOnline === false ? 'Sin conexión' : 'Iniciar carga'}
                          </Button>
                          <Button 
                            variant="outline"
                            onClick={() => handleReserve(evse)}
                            className="border-primary/50 hover:bg-primary/10"
                            disabled={station.isOnline === false}
                          >
                            <Calendar className="w-4 h-4" />
                          </Button>
                        </div>
                        )}
                      </div>
                    )}

                    {/* Mostrar info y acciones cuando el EVSE está RESERVED */}
                    {evse.status === "RESERVED" && (() => {
                      const isMyReservation = evse.activeReservationUserId && user?.id && String(evse.activeReservationUserId) === String(user.id);
                      const myRes = myReservations?.find((r: any) => r.id === evse.activeReservationId);
                      return (
                        <div className="mt-3 space-y-2">
                          {isMyReservation && myRes ? (
                            <>
                              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
                                <div className="flex items-center gap-2 text-purple-400 text-sm font-medium mb-1">
                                  <Calendar className="w-4 h-4" />
                                  Tu reserva
                                </div>
                                <div className="text-xs text-muted-foreground space-y-1">
                                  <div>
                                    {new Date(myRes.startTime).toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" })}
                                    {" a las "}
                                    {new Date(myRes.startTime).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                                  </div>
                                  {myRes.endTime && (
                                    <div>Hasta: {new Date(myRes.endTime).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}</div>
                                  )}
                                  {myRes.reservationFee && (
                                    <div className="text-purple-300">Tarifa: ${Number(myRes.reservationFee).toLocaleString()} COP</div>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  className="flex-1 border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
                                  onClick={() => setLocation("/reservations")}
                                >
                                  <CheckCircle2 className="w-4 h-4 mr-2" />
                                  Ver reservas
                                </Button>
                                <Button
                                  variant="outline"
                                  className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                                  onClick={() => {
                                    if (confirm("¿Cancelar esta reserva?")) {
                                      cancelReservation.mutate({ id: myRes.id });
                                    }
                                  }}
                                  disabled={cancelReservation.isPending}
                                >
                                  {cancelReservation.isPending ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <span className="text-xs">Cancelar</span>
                                  )}
                                </Button>
                              </div>
                            </>
                          ) : (
                            <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
                              <div className="text-xs text-purple-300">
                                Este conector está reservado por otro usuario.
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </Card>
                );
              })}
            </div>
          </motion.div>

          {/* Tarifas con Precio Dinámico */}
          <DynamicPricingCard stationId={stationId} />

          {/* Sugerencia de IA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <AIInsightCard 
              type="station" 
              stationId={stationId}
              demandLevel={currentKwhPrice?.factors?.demandLevel}
              surchargePercent={currentKwhPrice?.multiplier ? Math.round((currentKwhPrice.multiplier - 1) * 100) : undefined}
              currentPrice={currentKwhPrice?.dynamicPricePerKwh}
              onAskAI={(question) => {
                // Abrir el chat de IA con la pregunta
                const chatButton = document.querySelector('[data-ai-chat-trigger]') as HTMLButtonElement;
                if (chatButton) chatButton.click();
              }}
            />
          </motion.div>

          {/* Información adicional */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="p-4 bg-card/50 backdrop-blur border-border/50">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div className="text-sm text-muted-foreground">
                  {station.description || "Estación de carga operada por EVGreen."}
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Calificaciones y Opiniones */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <Card className="p-4 bg-card/50 backdrop-blur border-border/50 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-500" />
                  Calificaciones y Opiniones
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setShowReviewForm(!showReviewForm)}
                >
                  {showReviewForm ? "Cancelar" : "Calificar"}
                </Button>
              </div>

              {/* Resumen de calificación */}
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold">{stationRating !== null ? stationRating.toFixed(1) : "--"}</div>
                  <div className="flex gap-0.5 mt-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-3 h-3 ${stationRating !== null && s <= Math.round(stationRating) ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"}`}
                      />
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{totalReviews} opini{totalReviews === 1 ? "ón" : "ones"}</div>
                </div>
              </div>

              {/* Formulario de nueva calificación */}
              {showReviewForm && (
                <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
                  <div>
                    <Label className="text-sm">Tu calificación</Label>
                    <div className="flex gap-1 mt-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button
                          key={s}
                          onClick={() => setNewRating(s)}
                          className="p-0.5"
                        >
                          <Star
                            className={`w-7 h-7 transition-colors ${s <= newRating ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30 hover:text-yellow-500/50"}`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm">Comentario (opcional)</Label>
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Comparte tu experiencia..."
                      className="w-full mt-1 p-2 bg-background border border-border rounded-md text-sm resize-none h-20"
                      maxLength={1000}
                    />
                  </div>
                  <Button
                    size="sm"
                    className="w-full gradient-primary text-white"
                    onClick={handleSubmitReview}
                    disabled={submitReview.isPending || newRating === 0}
                  >
                    {submitReview.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    Enviar calificación
                  </Button>
                </div>
              )}

              {/* Lista de opiniones */}
              {reviewsData?.reviews && reviewsData.reviews.length > 0 ? (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {reviewsData.reviews.slice(0, 5).map((review: any) => (
                    <div key={review.id} className="p-3 bg-muted/20 rounded-lg space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold">
                            {(review.userName || "U").charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm font-medium">{review.userName || "Usuario"}</span>
                        </div>
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`w-3 h-3 ${s <= review.rating ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"}`}
                            />
                          ))}
                        </div>
                      </div>
                      {review.comment && (
                        <p className="text-sm text-muted-foreground">{review.comment}</p>
                      )}
                      <div className="text-xs text-muted-foreground/60">
                        {new Date(review.createdAt).toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" })}
                      </div>
                      {review.ownerResponse && (
                        <div className="mt-2 pl-3 border-l-2 border-primary/50">
                          <span className="text-xs font-medium text-primary">Respuesta del operador:</span>
                          <p className="text-xs text-muted-foreground">{review.ownerResponse}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2">
                  Aún no hay opiniones. ¡Sé el primero en calificar!
                </p>
              )}
            </Card>
          </motion.div>

          {/* Acciones rápidas */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="grid grid-cols-2 gap-3"
          >
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col gap-2"
              onClick={() => {
                if (station.latitude && station.longitude) {
                  const url = `https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}&travelmode=driving`;
                  window.open(url, '_blank');
                } else {
                  toast.error("No hay coordenadas disponibles para esta estación");
                }
              }}
            >
              <Navigation className="w-5 h-5" />
              <span className="text-xs">Cómo llegar</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col gap-2"
              onClick={() => {
                const phone = (station as any).contactPhone;
                if (phone) {
                  window.open(`tel:${phone}`, '_self');
                } else {
                  toast.info("Esta estación no tiene número de contacto registrado");
                }
              }}
            >
              <Phone className="w-5 h-5" />
              <span className="text-xs">Contactar</span>
            </Button>
          </motion.div>
        </div>
      </div>

      {/* Sheet de Reserva con Tarifa Dinámica (mobile-first) */}
      <Sheet open={showReservationModal} onOpenChange={setShowReservationModal}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] p-0">
          {/* Handle visual para arrastrar */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>
          
          <SheetHeader className="px-4 pb-2">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Calendar className="w-5 h-5 text-primary" />
              Reservar Cargador
            </SheetTitle>
            <SheetDescription className="text-xs">
              {selectedEvse && `Conector ${selectedEvse.connectorType?.replace("_", " ")} • ${selectedEvse.powerKw} kW`}
            </SheetDescription>
          </SheetHeader>

          <div className="overflow-y-auto px-4 pb-4" style={{ maxHeight: 'calc(85vh - 160px)' }}>
            <div className="space-y-3">
              {/* Fecha y hora en una fila */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Fecha</Label>
                  <Input
                    type="date"
                    value={reservationDate}
                    onChange={(e) => setReservationDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="bg-background/50 text-sm h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Hora de inicio</Label>
                  <Input
                    type="time"
                    value={reservationTime}
                    onChange={(e) => setReservationTime(e.target.value)}
                    className="bg-background/50 text-sm h-9"
                  />
                </div>
              </div>

              {/* Duración estimada */}
              <div className="space-y-1">
                <Label className="text-xs">Duración estimada</Label>
                <Select value={estimatedDuration} onValueChange={setEstimatedDuration}>
                  <SelectTrigger className="bg-background/50 h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 minutos</SelectItem>
                    <SelectItem value="60">1 hora</SelectItem>
                    <SelectItem value="90">1.5 horas</SelectItem>
                    <SelectItem value="120">2 horas</SelectItem>
                    <SelectItem value="180">3 horas</SelectItem>
                    <SelectItem value="240">4 horas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Tarifa Dinámica */}
              {priceLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : dynamicPrice ? (
                <div className={`p-3 rounded-lg border-2 ${
                  dynamicPrice.visualization.level === "LOW" ? "border-green-500/50 bg-green-500/10" :
                  dynamicPrice.visualization.level === "NORMAL" ? "border-blue-500/50 bg-blue-500/10" :
                  dynamicPrice.visualization.level === "HIGH" ? "border-orange-500/50 bg-orange-500/10" :
                  "border-red-500/50 bg-red-500/10"
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <div style={{ color: dynamicPrice.visualization.color }}>
                      {getDemandIcon(dynamicPrice.visualization.level)}
                    </div>
                    <span className="font-medium text-xs">{dynamicPrice.visualization.message}</span>
                    <Badge 
                      variant="outline"
                      className="ml-auto text-[10px] px-1.5 py-0"
                      style={{ 
                        borderColor: dynamicPrice.visualization.color,
                        color: dynamicPrice.visualization.color 
                      }}
                    >
                      {dynamicPrice.visualization.savingsOrSurge}
                    </Badge>
                  </div>

                  <div className="space-y-0.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Base</span>
                      <span>${dynamicPrice.basePrice.toLocaleString()}/kWh</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Dinámico</span>
                      <span className="font-semibold" style={{ color: dynamicPrice.visualization.color }}>
                        ${dynamicPrice.finalPrice.toLocaleString()}/kWh
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Reserva</span>
                      <span>${dynamicPrice.reservationFee.toLocaleString()}</span>
                    </div>
                    <div className="pt-1 mt-1 border-t border-border/50 flex justify-between items-center">
                      <span className="font-medium text-xs">Total estimado</span>
                      <span className="font-bold text-sm" style={{ color: dynamicPrice.visualization.color }}>
                        ${dynamicPrice.estimatedTotal.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="mt-1.5 pt-1.5 border-t border-border/50">
                    <p className="text-[10px] text-muted-foreground">
                      <AlertTriangle className="w-3 h-3 inline-block mr-1 align-text-bottom" />
                      No presentarse: <strong>${dynamicPrice.noShowPenalty.toLocaleString()} COP</strong>
                    </p>
                  </div>
                </div>
              ) : null}

              {/* Mejores horarios sugeridos */}
              {bestTimes && bestTimes.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Mejores horarios</Label>
                  <div className="flex gap-2 flex-wrap">
                    {bestTimes
                      .filter(t => t.recommendation === "BEST")
                      .slice(0, 4)
                      .map((slot, i) => (
                        <Button
                          key={i}
                          variant="outline"
                          size="sm"
                          className="border-green-500/50 text-green-400 hover:bg-green-500/10 text-xs h-7 px-2"
                          onClick={() => {
                            const d = new Date(slot.time);
                            setReservationDate(d.toISOString().split("T")[0]);
                            setReservationTime(d.toTimeString().slice(0, 5));
                          }}
                        >
                          {new Date(slot.time).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                        </Button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Botón fijo en la parte inferior */}
          <div className="px-4 pb-4 pt-2 border-t border-border/30">
            <Button
              className="w-full gradient-primary text-white h-11"
              onClick={handleConfirmReservation}
              disabled={createReservation.isPending || !dynamicPrice}
            >
              {createReservation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              Confirmar Reserva
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </UserLayout>
  );
}
