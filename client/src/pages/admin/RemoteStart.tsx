/**
 * EVGreen Platform - Inicio Remoto de Carga (Admin/Soporte)
 * 
 * Interfaz profesional para asistencia remota: permite a admin/soporte
 * iniciar una sesión de carga en nombre de un usuario que está en línea.
 * 
 * Flujo: Buscar usuario → Seleccionar estación/conector → Configurar carga → Confirmar → Iniciar
 * 
 * @author Green House Project
 */
import { useState, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Zap,
  Search,
  User,
  MapPin,
  Plug,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Phone,
  Mail,
  Wallet,
  ArrowRight,
  RefreshCw,
  History,
  Shield,
  Radio,
  ChevronRight,
  XCircle,
  Clock,
  Battery,
  DollarSign,
  Gauge,
  Info,
  TrendingUp,
} from "lucide-react";

// Tipos
type SearchedUser = {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: string;
  idTag: string;
};

type StationConnector = {
  id: number;
  connectorId: number;
  status: string;
  connectorType: string;
  maxPowerKw: number;
};

type Station = {
  id: number;
  name: string;
  address: string;
  ocppIdentity: string;
  isOnline: boolean;
  isConnected: boolean;
  connectors: StationConnector[];
};

type ChargeMode = "full_charge" | "by_kwh" | "by_amount" | "fixed_amount" | "percentage";

// Componente de estado del conector
function ConnectorStatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; label: string }> = {
    AVAILABLE: { color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", label: "Disponible" },
    CHARGING: { color: "bg-blue-500/20 text-blue-400 border-blue-500/30", label: "Cargando" },
    PREPARING: { color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", label: "Preparando" },
    FINISHING: { color: "bg-orange-500/20 text-orange-400 border-orange-500/30", label: "Finalizando" },
    OCCUPIED: { color: "bg-red-500/20 text-red-400 border-red-500/30", label: "Ocupado" },
    FAULTED: { color: "bg-red-500/20 text-red-400 border-red-500/30", label: "Error" },
    UNAVAILABLE: { color: "bg-gray-500/20 text-gray-400 border-gray-500/30", label: "No disponible" },
    SUSPENDED_EV: { color: "bg-amber-500/20 text-amber-400 border-amber-500/30", label: "Suspendido (EV)" },
    SUSPENDED_EVSE: { color: "bg-amber-500/20 text-amber-400 border-amber-500/30", label: "Suspendido (EVSE)" },
  };
  const c = config[status] || { color: "bg-gray-500/20 text-gray-400 border-gray-500/30", label: status };
  return <Badge variant="outline" className={`${c.color} text-xs`}>{c.label}</Badge>;
}

export default function AdminRemoteStart() {
  // ============ ESTADO DEL WIZARD ============
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Búsqueda de usuario
  const [userSearch, setUserSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<SearchedUser | null>(null);

  // Step 2: Selección de estación y conector
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [selectedConnector, setSelectedConnector] = useState<StationConnector | null>(null);
  const [stationFilter, setStationFilter] = useState("");

  // Step 3: Configuración de carga
  const [chargeMode, setChargeMode] = useState<ChargeMode>("full_charge");
  const [targetValue, setTargetValue] = useState<number>(100);
  const [reason, setReason] = useState("");

  // Step 4: Confirmación
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // ============ QUERIES ============
  const searchUsersQuery = trpc.adminRemoteStart.searchUsers.useQuery(
    { query: userSearch },
    { enabled: userSearch.length >= 2 }
  );

  const stationsQuery = trpc.adminRemoteStart.getAvailableStations.useQuery(undefined, {
    enabled: step >= 2,
  });

  const priceQuery = trpc.adminRemoteStart.getEstimatedPrice.useQuery(
    {
      stationId: selectedStation?.id || 0,
      connectorId: selectedConnector?.connectorId || 0,
      userId: selectedUser?.id || 0,
    },
    {
      enabled: !!selectedStation && !!selectedConnector && !!selectedUser,
    }
  );

  // Cálculos dinámicos de estimación según modo de carga
  const estimation = useMemo(() => {
    if (!priceQuery?.data) return null;
    const price = priceQuery.data.pricePerKwh;
    const balance = priceQuery.data.userBalance;
    const avgBattery = 60; // kWh promedio
    let estKwh = 0;
    let estCost = 0;
    let estTime = 0;
    const maxPower = priceQuery.data.maxPowerKw || 7;

    switch (chargeMode) {
      case "full_charge":
        estKwh = 0.8 * avgBattery;
        estCost = estKwh * price;
        break;
      case "by_kwh":
        estKwh = targetValue;
        estCost = targetValue * price;
        break;
      case "by_amount":
        estCost = targetValue;
        estKwh = price > 0 ? targetValue / price : 0;
        break;
      case "fixed_amount":
        estCost = targetValue;
        estKwh = price > 0 ? targetValue / price : 0;
        break;
      case "percentage":
        estKwh = ((targetValue - 20) / 100) * avgBattery;
        estCost = estKwh * price;
        break;
    }
    estTime = maxPower > 0 ? (estKwh / maxPower) * 60 : 0; // minutos
    const balanceSufficient = balance >= estCost;
    const maxKwhWithBalance = price > 0 ? balance / price : 0;
    return {
      estKwh: Math.round(estKwh * 100) / 100,
      estCost: Math.round(estCost),
      estTime: Math.round(estTime),
      balanceSufficient,
      maxKwhWithBalance: Math.round(maxKwhWithBalance * 100) / 100,
      maxAmountWithBalance: Math.round(balance),
    };
  }, [chargeMode, targetValue, priceQuery?.data]);

  const startMutation = trpc.adminRemoteStart.startRemoteCharge.useMutation({
    onSuccess: (data) => {
      setShowConfirmDialog(false);
      toast.success(data.message, {
        description: `Sesión: ${data.sessionId?.slice(0, 8)}... | Precio: $${data.pricePerKwh?.toLocaleString("es-CO")} COP/kWh`,
        duration: 8000,
      });
      if (data.insufficientBalance) {
        toast.warning("Saldo insuficiente", {
          description: `El usuario tiene $${data.userBalance?.toLocaleString("es-CO")} COP. Costo estimado: $${data.estimatedCost?.toLocaleString("es-CO")} COP`,
          duration: 10000,
        });
      }
      // Reset wizard
      setStep(1);
      setSelectedUser(null);
      setSelectedStation(null);
      setSelectedConnector(null);
      setChargeMode("full_charge");
      setTargetValue(100);
      setReason("");
      setUserSearch("");
    },
    onError: (error) => {
      toast.error("Error al iniciar carga remota", {
        description: error.message,
        duration: 8000,
      });
    },
  });

  // ============ FILTRADO DE ESTACIONES ============
  const filteredStations = useMemo(() => {
    if (!stationsQuery.data) return [];
    const q = stationFilter.toLowerCase();
    return stationsQuery.data.filter(
      (s: Station) =>
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.address?.toLowerCase().includes(q) ||
        s.ocppIdentity?.toLowerCase().includes(q)
    );
  }, [stationsQuery.data, stationFilter]);

  // ============ HANDLERS ============
  const handleSelectUser = useCallback((user: SearchedUser) => {
    setSelectedUser(user);
    setStep(2);
    toast.info(`Usuario seleccionado: ${user.name}`, { duration: 2000 });
  }, []);

  const handleSelectStation = useCallback((station: Station) => {
    setSelectedStation(station);
    setSelectedConnector(null);
  }, []);

  const handleSelectConnector = useCallback((connector: StationConnector) => {
    setSelectedConnector(connector);
    setStep(3);
  }, []);

  const handleConfirmStart = useCallback(() => {
    if (!selectedUser || !selectedStation || !selectedConnector) return;
    startMutation.mutate({
      userId: selectedUser.id,
      stationId: selectedStation.id,
      connectorId: selectedConnector.connectorId,
      chargeMode,
      targetValue: chargeMode === "full_charge" ? 100 : targetValue,
      reason,
    });
  }, [selectedUser, selectedStation, selectedConnector, chargeMode, targetValue, reason, startMutation]);

  const handleReset = useCallback(() => {
    setStep(1);
    setSelectedUser(null);
    setSelectedStation(null);
    setSelectedConnector(null);
    setChargeMode("full_charge");
    setTargetValue(100);
    setReason("");
    setUserSearch("");
    setStationFilter("");
  }, []);

  // ============ RENDER ============
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            Inicio Remoto de Carga
          </h1>
          <p className="text-muted-foreground mt-1">
            Asistencia remota: inicia una sesión de carga en nombre de un usuario
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Reiniciar
          </Button>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2 p-4 bg-card rounded-lg border border-border">
        {[
          { num: 1, label: "Usuario", icon: User },
          { num: 2, label: "Estación", icon: MapPin },
          { num: 3, label: "Configurar", icon: Zap },
          { num: 4, label: "Confirmar", icon: CheckCircle2 },
        ].map((s, i) => (
          <div key={s.num} className="flex items-center gap-2 flex-1">
            <button
              onClick={() => {
                if (s.num === 1) setStep(1);
                else if (s.num === 2 && selectedUser) setStep(2);
                else if (s.num === 3 && selectedUser && selectedStation && selectedConnector) setStep(3);
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-md transition-all w-full ${
                step === s.num
                  ? "bg-primary text-primary-foreground font-medium"
                  : step > s.num
                  ? "bg-primary/20 text-primary cursor-pointer hover:bg-primary/30"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <s.icon className="h-4 w-4 shrink-0" />
              <span className="text-sm truncate">{s.label}</span>
            </button>
            {i < 3 && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
          </div>
        ))}
      </div>

      {/* Selected context bar */}
      {selectedUser && (
        <div className="flex items-center gap-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{selectedUser.name}</span>
            <span className="text-xs text-muted-foreground">({selectedUser.email})</span>
          </div>
          {selectedStation && (
            <>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{selectedStation.name}</span>
                {selectedStation.isConnected ? (
                  <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                    <Radio className="h-3 w-3 mr-1" />Conectada
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">
                    Desconectada
                  </Badge>
                )}
              </div>
            </>
          )}
          {selectedConnector && (
            <>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <div className="flex items-center gap-2">
                <Plug className="h-4 w-4 text-primary" />
                <span className="text-sm">Conector #{selectedConnector.connectorId}</span>
                <ConnectorStatusBadge status={selectedConnector.status} />
              </div>
            </>
          )}
        </div>
      )}

      {/* ============ STEP 1: BUSCAR USUARIO ============ */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="bg-card rounded-lg border border-border p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              Buscar Usuario
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Busca al usuario por nombre, email o teléfono para iniciar la carga en su nombre.
            </p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Nombre, email o teléfono del usuario..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="pl-10 h-12 text-base"
                autoFocus
              />
            </div>

            {/* Resultados de búsqueda */}
            {searchUsersQuery.isLoading && userSearch.length >= 2 && (
              <div className="flex items-center gap-2 mt-4 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Buscando usuarios...</span>
              </div>
            )}

            {searchUsersQuery.data && searchUsersQuery.data.length > 0 && (
              <div className="mt-4 space-y-2 max-h-[400px] overflow-y-auto">
                {searchUsersQuery.data.map((user: SearchedUser) => (
                  <button
                    key={user.id}
                    onClick={() => handleSelectUser(user)}
                    className={`w-full flex items-center gap-4 p-4 rounded-lg border transition-all text-left ${
                      selectedUser?.id === user.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50 hover:bg-accent/50"
                    }`}
                  >
                    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{user.name}</span>
                        <Badge variant="outline" className="text-xs shrink-0">{user.role}</Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-1">
                        {user.email && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Mail className="h-3 w-3" />{user.email}
                          </span>
                        )}
                        {user.phone && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" />{user.phone}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            )}

            {searchUsersQuery.data && searchUsersQuery.data.length === 0 && userSearch.length >= 2 && (
              <div className="mt-4 text-center py-8 text-muted-foreground">
                <XCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No se encontraron usuarios para "{userSearch}"</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============ STEP 2: SELECCIONAR ESTACIÓN Y CONECTOR ============ */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="bg-card rounded-lg border border-border p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Seleccionar Estación y Conector
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Selecciona la estación de carga y el conector donde el usuario necesita iniciar la carga.
            </p>

            {/* Filtro de estaciones */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filtrar estaciones por nombre, dirección u OCPP ID..."
                value={stationFilter}
                onChange={(e) => setStationFilter(e.target.value)}
                className="pl-10"
              />
            </div>

            {stationsQuery.isLoading && (
              <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Cargando estaciones...</span>
              </div>
            )}

            {/* Lista de estaciones */}
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {filteredStations.map((station: Station) => (
                <div
                  key={station.id}
                  className={`rounded-lg border transition-all ${
                    selectedStation?.id === station.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  {/* Station header */}
                  <button
                    onClick={() => handleSelectStation(station)}
                    className="w-full flex items-center gap-4 p-4 text-left"
                  >
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                      station.isConnected ? "bg-emerald-500/20" : "bg-gray-500/20"
                    }`}>
                      <MapPin className={`h-5 w-5 ${station.isConnected ? "text-emerald-400" : "text-gray-400"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{station.name}</span>
                        {station.isConnected ? (
                          <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs shrink-0">
                            <Radio className="h-3 w-3 mr-1" />OCPP
                          </Badge>
                        ) : station.isOnline ? (
                          <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs shrink-0">
                            Online (sin OCPP)
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-gray-500/20 text-gray-400 border-gray-500/30 text-xs shrink-0">
                            Offline
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 truncate">{station.address}</p>
                      <p className="text-xs text-muted-foreground/60 font-mono">{station.ocppIdentity}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {station.connectors.length} conector{station.connectors.length !== 1 ? "es" : ""}
                      </span>
                    </div>
                  </button>

                  {/* Connectors (expanded when station is selected) */}
                  {selectedStation?.id === station.id && (
                    <div className="border-t border-border px-4 pb-4 pt-3">
                      <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wide">Conectores</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {station.connectors.map((connector) => (
                          <button
                            key={connector.id}
                            onClick={() => handleSelectConnector(connector)}
                            disabled={connector.status === "FAULTED"}
                            className={`flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                              selectedConnector?.id === connector.id
                                ? "border-primary bg-primary/10"
                                : connector.status === "CHARGING" || connector.status === "FAULTED"
                                ? "border-border opacity-50 cursor-not-allowed"
                                : "border-border hover:border-primary/50 hover:bg-accent/30"
                            }`}
                          >
                            <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                              connector.status === "AVAILABLE" ? "bg-emerald-500/20" :
                              connector.status === "PREPARING" ? "bg-yellow-500/20" :
                              "bg-gray-500/20"
                            }`}>
                              <Plug className={`h-4 w-4 ${
                                connector.status === "AVAILABLE" ? "text-emerald-400" :
                                connector.status === "PREPARING" ? "text-yellow-400" :
                                "text-gray-400"
                              }`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">#{connector.connectorId}</span>
                                <ConnectorStatusBadge status={connector.status} />
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {connector.connectorType} - {connector.maxPowerKw > 0 ? `${connector.maxPowerKw} kW` : "N/A"}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {filteredStations.length === 0 && !stationsQuery.isLoading && (
                <div className="text-center py-8 text-muted-foreground">
                  <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No se encontraron estaciones activas</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============ STEP 3: CONFIGURAR CARGA ============ */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="bg-card rounded-lg border border-border p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Configurar Sesión de Carga
            </h2>

            {/* Precio y saldo */}
            {priceQuery.data && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <p className="text-xs text-muted-foreground mb-1">Tarifa actual</p>
                  <p className="text-xl font-bold text-primary">
                    ${priceQuery.data.pricePerKwh.toLocaleString("es-CO")}
                  </p>
                  <p className="text-xs text-muted-foreground">COP/kWh</p>
                  {priceQuery.data.subscriptionDiscount > 0 && (
                    <Badge className="mt-1 bg-emerald-500/20 text-emerald-400 text-xs">
                      -{priceQuery.data.subscriptionDiscount}% suscripción
                    </Badge>
                  )}
                </div>
                <div className="p-4 rounded-lg bg-accent/50 border border-border">
                  <p className="text-xs text-muted-foreground mb-1">Saldo del usuario</p>
                  <p className={`text-xl font-bold ${priceQuery.data.userBalance > 5000 ? "text-emerald-400" : "text-red-400"}`}>
                    ${priceQuery.data.userBalance.toLocaleString("es-CO")}
                  </p>
                  <p className="text-xs text-muted-foreground">COP disponible</p>
                </div>
                <div className="p-4 rounded-lg bg-accent/50 border border-border">
                  <p className="text-xs text-muted-foreground mb-1">Conector</p>
                  <p className="text-xl font-bold">{priceQuery.data.connectorType}</p>
                  <p className="text-xs text-muted-foreground">
                    {priceQuery.data.maxPowerKw > 0 ? `${priceQuery.data.maxPowerKw} kW máx` : "Potencia N/A"}
                  </p>
                </div>
              </div>
            )}

            {priceQuery.isLoading && (
              <div className="flex items-center gap-2 text-muted-foreground mb-6">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Calculando tarifa...</span>
              </div>
            )}

            {/* Modo de carga - Selector visual con tarjetas */}
            <div className="space-y-5">
              <div>
                <Label className="text-sm font-medium mb-3 block">Modo de carga</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { value: "full_charge" as ChargeMode, label: "Carga completa", desc: "100% bater\u00eda", icon: Battery },
                    { value: "by_kwh" as ChargeMode, label: "Por kWh", desc: "L\u00edmite de energ\u00eda", icon: Gauge },
                    { value: "by_amount" as ChargeMode, label: "Por monto", desc: "L\u00edmite en COP", icon: DollarSign },
                    { value: "percentage" as ChargeMode, label: "Porcentaje", desc: "% de bater\u00eda", icon: TrendingUp },
                  ].map((mode) => (
                    <button
                      key={mode.value}
                      onClick={() => {
                        setChargeMode(mode.value);
                        if (mode.value === "full_charge") setTargetValue(100);
                        else if (mode.value === "by_kwh") setTargetValue(10);
                        else if (mode.value === "by_amount") setTargetValue(20000);
                        else if (mode.value === "percentage") setTargetValue(80);
                      }}
                      className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all text-center ${
                        chargeMode === mode.value
                          ? "border-primary bg-primary/10 shadow-md shadow-primary/10"
                          : "border-border hover:border-primary/40 hover:bg-accent/30"
                      }`}
                    >
                      <mode.icon className={`h-6 w-6 ${
                        chargeMode === mode.value ? "text-primary" : "text-muted-foreground"
                      }`} />
                      <span className={`text-sm font-medium ${
                        chargeMode === mode.value ? "text-primary" : ""
                      }`}>{mode.label}</span>
                      <span className="text-xs text-muted-foreground">{mode.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Campo din\u00e1mico seg\u00fan modo seleccionado */}
              {chargeMode === "by_kwh" && (
                <div className="p-4 rounded-lg border border-primary/20 bg-primary/5">
                  <Label className="text-sm font-medium mb-2 block flex items-center gap-2">
                    <Gauge className="h-4 w-4 text-primary" />
                    Energ\u00eda a entregar (kWh)
                  </Label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      min={1}
                      max={200}
                      step={1}
                      value={targetValue}
                      onChange={(e) => setTargetValue(Number(e.target.value))}
                      placeholder="Ej: 10"
                      className="text-lg font-bold"
                    />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">kWh</span>
                  </div>
                  {estimation && (
                    <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Costo est.: <strong className="text-foreground">${estimation.estCost.toLocaleString("es-CO")} COP</strong></span>
                      <span>Tiempo est.: <strong className="text-foreground">~{estimation.estTime} min</strong></span>
                    </div>
                  )}
                  {estimation && (
                    <p className="text-xs text-muted-foreground/70 mt-2 flex items-center gap-1">
                      <Info className="h-3 w-3" />
                      M\u00e1x. con saldo del usuario: {estimation.maxKwhWithBalance} kWh
                    </p>
                  )}
                </div>
              )}

              {(chargeMode === "by_amount" || chargeMode === "fixed_amount") && (
                <div className="p-4 rounded-lg border border-primary/20 bg-primary/5">
                  <Label className="text-sm font-medium mb-2 block flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-primary" />
                    Monto m\u00e1ximo a cobrar (COP)
                  </Label>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-muted-foreground">$</span>
                    <Input
                      type="number"
                      min={1000}
                      step={1000}
                      value={targetValue}
                      onChange={(e) => setTargetValue(Number(e.target.value))}
                      placeholder="Ej: 20000"
                      className="text-lg font-bold"
                    />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">COP</span>
                  </div>
                  {/* Botones r\u00e1pidos de monto */}
                  <div className="flex gap-2 mt-3">
                    {[5000, 10000, 20000, 50000].map((amount) => (
                      <button
                        key={amount}
                        onClick={() => setTargetValue(amount)}
                        className={`px-3 py-1 rounded-md text-xs font-medium border transition-all ${
                          targetValue === amount
                            ? "border-primary bg-primary/20 text-primary"
                            : "border-border hover:border-primary/40 text-muted-foreground"
                        }`}
                      >
                        ${amount.toLocaleString("es-CO")}
                      </button>
                    ))}
                  </div>
                  {estimation && (
                    <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Energ\u00eda est.: <strong className="text-foreground">~{estimation.estKwh} kWh</strong></span>
                      <span>Tiempo est.: <strong className="text-foreground">~{estimation.estTime} min</strong></span>
                    </div>
                  )}
                  {estimation && (
                    <p className="text-xs text-muted-foreground/70 mt-2 flex items-center gap-1">
                      <Info className="h-3 w-3" />
                      Saldo disponible del usuario: ${estimation.maxAmountWithBalance.toLocaleString("es-CO")} COP
                    </p>
                  )}
                </div>
              )}

              {chargeMode === "percentage" && (
                <div className="p-4 rounded-lg border border-primary/20 bg-primary/5">
                  <Label className="text-sm font-medium mb-2 block flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Porcentaje objetivo de bater\u00eda
                  </Label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      min={20}
                      max={100}
                      step={5}
                      value={targetValue}
                      onChange={(e) => setTargetValue(Number(e.target.value))}
                      placeholder="Ej: 80"
                      className="text-lg font-bold"
                    />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">%</span>
                  </div>
                  {/* Botones r\u00e1pidos de porcentaje */}
                  <div className="flex gap-2 mt-3">
                    {[50, 60, 80, 100].map((pct) => (
                      <button
                        key={pct}
                        onClick={() => setTargetValue(pct)}
                        className={`px-3 py-1 rounded-md text-xs font-medium border transition-all ${
                          targetValue === pct
                            ? "border-primary bg-primary/20 text-primary"
                            : "border-border hover:border-primary/40 text-muted-foreground"
                        }`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                  {estimation && (
                    <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Energ\u00eda est.: <strong className="text-foreground">~{estimation.estKwh} kWh</strong></span>
                      <span>Costo est.: <strong className="text-foreground">${estimation.estCost.toLocaleString("es-CO")} COP</strong></span>
                      <span>Tiempo est.: <strong className="text-foreground">~{estimation.estTime} min</strong></span>
                    </div>
                  )}
                </div>
              )}

              {chargeMode === "full_charge" && estimation && (
                <div className="p-4 rounded-lg border border-border bg-accent/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Battery className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Estimaci\u00f3n de carga completa</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-lg font-bold text-primary">~{estimation.estKwh} kWh</p>
                      <p className="text-xs text-muted-foreground">Energ\u00eda</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold">${estimation.estCost.toLocaleString("es-CO")}</p>
                      <p className="text-xs text-muted-foreground">Costo COP</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold">~{estimation.estTime} min</p>
                      <p className="text-xs text-muted-foreground">Tiempo</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground/60 mt-3 text-center">
                    Basado en bater\u00eda promedio de 60 kWh (20%\u219280%)
                  </p>
                </div>
              )}

              {/* Motivo de la asistencia (OBLIGATORIO) */}
              <div>
                <Label className="text-sm font-medium mb-2 block flex items-center gap-1">
                  <Shield className="h-4 w-4 text-primary" />
                  Motivo de la asistencia remota *
                </Label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Describe el motivo por el cual inicias esta carga en nombre del usuario (ej: usuario reporta error en la app, asistencia telef\u00f3nica, etc.)"
                  rows={3}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Este motivo queda registrado en la auditor\u00eda del sistema
                </p>
              </div>

              {/* Advertencia de saldo insuficiente din\u00e1mica */}
              {estimation && !estimation.balanceSufficient && (
                <div className="flex items-start gap-3 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                  <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-400">Saldo insuficiente para esta configuraci\u00f3n</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      El usuario tiene <strong>${estimation.maxAmountWithBalance.toLocaleString("es-CO")} COP</strong> disponibles,
                      pero el costo estimado es <strong>${estimation.estCost.toLocaleString("es-CO")} COP</strong>.
                      La carga se detendr\u00e1 cuando se agote el saldo.
                    </p>
                  </div>
                </div>
              )}

              {estimation && estimation.balanceSufficient && priceQuery.data && priceQuery.data.userBalance < estimation.estCost * 1.2 && (
                <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <Info className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-400">Saldo ajustado</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      El saldo del usuario cubre esta carga pero con poco margen.
                      Saldo: ${estimation.maxAmountWithBalance.toLocaleString("es-CO")} COP | Costo est.: ${estimation.estCost.toLocaleString("es-CO")} COP
                    </p>
                  </div>
                </div>
              )}

              {/* Bot\u00f3n de continuar */}
              <div className="flex justify-end pt-4">
                <Button
                  size="lg"
                  onClick={() => {
                    if (reason.length < 3) {
                      toast.error("Debes indicar un motivo para la asistencia remota");
                      return;
                    }
                    setStep(4);
                    setShowConfirmDialog(true);
                  }}
                  disabled={reason.length < 3}
                  className="gap-2"
                >
                  <Zap className="h-4 w-4" />
                  Revisar y Confirmar
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============ STEP 4: DIÁLOGO DE CONFIRMACIÓN ============ */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Confirmar Inicio Remoto de Carga
            </DialogTitle>
            <DialogDescription>
              Revisa los datos antes de enviar el comando al cargador. Esta acción queda registrada en la auditoría.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Resumen */}
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/50">
                <User className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Usuario</p>
                  <p className="text-sm font-medium">{selectedUser?.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedUser?.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/50">
                <MapPin className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Estación</p>
                  <p className="text-sm font-medium">{selectedStation?.name}</p>
                  <p className="text-xs text-muted-foreground">Conector #{selectedConnector?.connectorId} - {selectedConnector?.connectorType}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/50">
                <Zap className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Modo de carga</p>
                  <p className="text-sm font-medium">
                    {chargeMode === "full_charge" && "Carga completa (100%)"}
                    {chargeMode === "by_kwh" && `L\u00edmite: ${targetValue} kWh`}
                    {chargeMode === "by_amount" && `L\u00edmite: $${targetValue.toLocaleString("es-CO")} COP`}
                    {chargeMode === "fixed_amount" && `Monto fijo: $${targetValue.toLocaleString("es-CO")} COP`}
                    {chargeMode === "percentage" && `Hasta ${targetValue}% de bater\u00eda`}
                  </p>
                  {priceQuery.data && (
                    <p className="text-xs text-muted-foreground">
                      Tarifa: ${priceQuery.data.pricePerKwh.toLocaleString("es-CO")} COP/kWh
                    </p>
                  )}
                  {estimation && (
                    <p className="text-xs text-muted-foreground">
                      Est.: ~{estimation.estKwh} kWh | ~${estimation.estCost.toLocaleString("es-CO")} COP | ~{estimation.estTime} min
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/50">
                <Shield className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Motivo</p>
                  <p className="text-sm">{reason}</p>
                </div>
              </div>
            </div>

            {/* Advertencia */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
              <AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Al confirmar, se enviará el comando <strong>RemoteStartTransaction</strong> al cargador.
                El usuario recibirá una notificación push y en la app. Esta acción queda registrada con tu nombre en la auditoría del sistema.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)} disabled={startMutation.isPending}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmStart}
              disabled={startMutation.isPending}
              className="gap-2"
            >
              {startMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enviando comando...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  Iniciar Carga Remota
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
