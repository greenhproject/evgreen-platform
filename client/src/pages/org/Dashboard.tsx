/**
 * Org Dashboard - Panel principal del portal de organización SaaS
 * Muestra resumen de la organización, métricas avanzadas (kWh, sesiones, ingresos), estaciones y tickets activos
 */
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Building,
  MapPin,
  Ticket,
  Zap,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  TrendingUp,
  Users,
  DollarSign,
  Activity,
  Rocket,
  X,
  Circle,
  Settings,
  CreditCard,
  ChevronRight,
} from "lucide-react";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";

type Period = "7d" | "30d" | "90d" | "all";

export default function OrgDashboard() {
  const [, setLocation] = useLocation();
  const [period, setPeriod] = useState<Period>("30d");

  const { data: org, isLoading: orgLoading } = (trpc.organizations as any).getMyOrg.useQuery();
  const { data: stations } = (trpc.organizations as any).getMyStations.useQuery();
  const { data: tickets } = (trpc.organizations as any).getMyTickets.useQuery();
  const { data: stats } = (trpc.organizations as any).getMyOrgStats.useQuery(
    { period },
    { keepPreviousData: true }
  );

  const onlineStations = stations?.filter((s: any) => s.isOnline) || [];
  const offlineStations = stations?.filter((s: any) => !s.isOnline) || [];
  const openTickets = tickets?.filter((t: any) => t.status === "OPEN" || t.status === "IN_PROGRESS") || [];

  if (orgLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Cargando organización...</div>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Building className="h-16 w-16 text-muted-foreground opacity-30" />
        <div className="text-center">
          <p className="text-lg font-medium">No perteneces a ninguna organización</p>
          <p className="text-sm text-muted-foreground mt-1">
            Contacta al administrador de EVGreen para ser asignado a una organización.
          </p>
        </div>
      </div>
    );
  }

  const planColors: Record<string, string> = {
    starter: "bg-gray-500/20 text-gray-300 border-gray-500/30",
    professional: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    enterprise: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  };

  const statusColors: Record<string, string> = {
    active: "bg-green-500/20 text-green-400 border-green-500/30",
    trial: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    suspended: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    cancelled: "bg-red-500/20 text-red-400 border-red-500/30",
  };

  const periodLabels: Record<Period, string> = {
    "7d": "7 días",
    "30d": "30 días",
    "90d": "90 días",
    "all": "Todo",
  };

  const formatCOP = (value: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building className="h-7 w-7 text-green-400" />
            {org.name}
          </h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge variant="outline" className={planColors[org.plan] || ""}>
              Plan {org.plan}
            </Badge>
            <Badge variant="outline" className={statusColors[org.status] || ""}>
              {org.status === "active" ? "Activo" :
               org.status === "trial" ? "Trial" :
               org.status === "suspended" ? "Suspendido" : "Cancelado"}
            </Badge>
            {org.myRole && (
              <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30">
                {org.myRole === "admin" ? "Administrador" : "Visualizador"}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">{org.slug}.evgreen.lat</p>
        </div>
        {/* Period Selector */}
        <div className="flex gap-1 bg-muted rounded-lg p-1 self-start">
          {(["7d", "30d", "90d", "all"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                period === p
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>
      </div>

      {/* First Day Checklist */}
      <FirstDayChecklist
        stations={stations || []}
        org={org}
        onNavigate={setLocation}
      />

      {/* Infrastructure Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <MapPin className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stations?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Estaciones</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <CheckCircle className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-400">{onlineStations.length}</p>
                <p className="text-xs text-muted-foreground">En Línea</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <AlertCircle className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-400">{offlineStations.length}</p>
                <p className="text-xs text-muted-foreground">Offline</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Ticket className="h-5 w-5 text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-400">{openTickets.length}</p>
                <p className="text-xs text-muted-foreground">Tickets Abiertos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Metrics */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Métricas de Rendimiento — {periodLabels[period]}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-border/50">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Sesiones</p>
                  <p className="text-2xl font-bold mt-1">{stats?.totalSessions ?? "—"}</p>
                </div>
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Activity className="h-4 w-4 text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">kWh Entregados</p>
                  <p className="text-2xl font-bold mt-1">
                    {stats ? stats.totalKwh.toFixed(1) : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">kWh</p>
                </div>
                <div className="p-2 rounded-lg bg-yellow-500/10">
                  <Zap className="h-4 w-4 text-yellow-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Ingresos</p>
                  <p className="text-xl font-bold mt-1">
                    {stats ? formatCOP(stats.totalRevenue) : "—"}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-green-500/10">
                  <DollarSign className="h-4 w-4 text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Usuarios Únicos</p>
                  <p className="text-2xl font-bold mt-1">{stats?.uniqueUsers ?? "—"}</p>
                </div>
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Users className="h-4 w-4 text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Avg kWh per session */}
      {stats && stats.totalSessions > 0 && (
        <Card className="border-border/50 bg-gradient-to-r from-green-500/5 to-transparent">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-green-400 shrink-0" />
              <div className="flex gap-6 flex-wrap">
                <div>
                  <span className="text-xs text-muted-foreground">Promedio por sesión: </span>
                  <span className="text-sm font-semibold text-green-400">
                    {stats.avgKwhPerSession.toFixed(2)} kWh
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Ingreso por sesión: </span>
                  <span className="text-sm font-semibold text-green-400">
                    {formatCOP(stats.totalSessions > 0 ? stats.totalRevenue / stats.totalSessions : 0)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stations & Tickets */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Stations List */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-green-400" />
                Mis Estaciones
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="text-green-400 h-7 text-xs"
                onClick={() => setLocation("/org/stations")}
              >
                Ver todas
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!stations || stations.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                <MapPin className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No hay estaciones asignadas</p>
              </div>
            ) : (
              <div className="space-y-2">
                {stations?.slice(0, 5).map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between py-1.5 gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {s.city || s.address || "Sin ubicación"}
                      </p>
                    </div>
                    <div className={`flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
                      s.isOnline
                        ? "bg-green-500/10 text-green-400"
                        : "bg-red-500/10 text-red-400"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${s.isOnline ? "bg-green-400" : "bg-red-400"}`} />
                      {s.isOnline ? "Online" : "Offline"}
                    </div>
                  </div>
                ))}
                {stations?.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    +{stations.length - 5} más
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Tickets */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Ticket className="h-4 w-4 text-orange-400" />
                Tickets Recientes
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="text-green-400 h-7 text-xs"
                onClick={() => setLocation("/org/support")}
              >
                Ver todos
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!tickets || tickets.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                <Ticket className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No hay tickets de soporte</p>
                <Button
                  size="sm"
                  className="mt-3 bg-green-600 hover:bg-green-700"
                  onClick={() => setLocation("/org/support")}
                >
                  Crear ticket
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {tickets?.slice(0, 5).map((t: any) => (
                  <div key={t.id} className="flex items-start justify-between py-1.5 gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{t.subject}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.createdAt ? new Date(t.createdAt).toLocaleDateString("es-CO") : "-"}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        t.status === "OPEN" ? "bg-blue-500/20 text-blue-400 text-xs" :
                        t.status === "IN_PROGRESS" ? "bg-yellow-500/20 text-yellow-400 text-xs" :
                        t.status === "RESOLVED" ? "bg-green-500/20 text-green-400 text-xs" :
                        "bg-gray-500/20 text-gray-400 text-xs"
                      }
                    >
                      {t.status === "OPEN" ? "Abierto" :
                       t.status === "IN_PROGRESS" ? "En Progreso" :
                       t.status === "RESOLVED" ? "Resuelto" : "Cerrado"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Org Info */}
      {(org.contactName || org.contactEmail || org.nit) && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Información de la Organización</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              {org.contactName && (
                <div>
                  <p className="text-muted-foreground">Contacto</p>
                  <p className="font-medium">{org.contactName}</p>
                </div>
              )}
              {org.contactEmail && (
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p className="font-medium">{org.contactEmail}</p>
                </div>
              )}
              {org.nit && (
                <div>
                  <p className="text-muted-foreground">NIT</p>
                  <p className="font-medium">{org.nit}</p>
                </div>
              )}
              {org.maxChargers && (
                <div>
                  <p className="text-muted-foreground">Máx. Cargadores</p>
                  <p className="font-medium">{org.maxChargers}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground">Red EVGreen</p>
                <p className={`font-medium ${org.networkMember ? "text-green-400" : "text-gray-400"}`}>
                  {org.networkMember ? "Miembro activo" : "Red propia"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Soporte</p>
                <p className={`font-medium ${org.supportIncluded ? "text-green-400" : "text-gray-400"}`}>
                  {org.supportIncluded ? "Incluido (20%)" : "Autogestión"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ==========================================
// First Day Checklist Component
// ==========================================
const CHECKLIST_DISMISSED_KEY = "evgreen_checklist_dismissed";

interface ChecklistProps {
  stations: any[];
  org: any;
  onNavigate: (path: string) => void;
}

function FirstDayChecklist({ stations, org, onNavigate }: ChecklistProps) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const val = localStorage.getItem(`${CHECKLIST_DISMISSED_KEY}_${org?.id}`);
    if (val === "true") setDismissed(true);
  }, [org?.id]);

  const handleDismiss = () => {
    localStorage.setItem(`${CHECKLIST_DISMISSED_KEY}_${org?.id}`, "true");
    setDismissed(true);
  };

  // Determine checklist items dynamically
  const hasStations = stations.length > 0;
  const hasOnlineStation = stations.some((s: any) => s.isOnline);
  const hasTariff = stations.some((s: any) => s.tariffId || s.pricePerKwh);
  const profileComplete = !!(org?.contactName && org?.contactEmail);

  const items = [
    {
      id: "profile",
      label: "Completa el perfil de tu organización",
      description: "Agrega logo, colores y datos de contacto",
      done: profileComplete,
      action: () => onNavigate("/org/settings"),
      icon: Settings,
      actionLabel: "Ir a Configuración",
    },
    {
      id: "stations",
      label: "Verifica tus estaciones asignadas",
      description: `${hasStations ? `${stations.length} estación${stations.length !== 1 ? "es" : ""} asignada${stations.length !== 1 ? "s" : ""}` : "Aún no tienes estaciones — contacta a soporte"}`,
      done: hasStations,
      action: () => onNavigate("/org/stations"),
      icon: MapPin,
      actionLabel: "Ver Estaciones",
    },
    {
      id: "ocpp",
      label: "Conecta tu primer cargador vía OCPP",
      description: "Obtén la URL y credenciales en Estaciones → Configurar → Tab OCPP",
      done: hasOnlineStation,
      action: () => onNavigate("/org/stations"),
      icon: Zap,
      actionLabel: "Ver credenciales OCPP",
    },
    {
      id: "tariff",
      label: "Configura la tarifa de carga",
      description: "Define el precio por kWh para que los conductores puedan pagar",
      done: hasTariff,
      action: () => onNavigate("/org/stations"),
      icon: CreditCard,
      actionLabel: "Configurar tarifa",
    },
  ];

  const completedCount = items.filter(i => i.done).length;
  const allDone = completedCount === items.length;

  // Don't show if dismissed or all done for more than 1 station connected
  if (dismissed || (allDone && hasOnlineStation)) return null;

  const progress = Math.round((completedCount / items.length) * 100);

  return (
    <Card className="border-green-500/30 bg-gradient-to-br from-green-500/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-green-500/20">
              <Rocket className="h-4 w-4 text-green-400" />
            </div>
            <div>
              <CardTitle className="text-base">Primeros pasos para operar</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{completedCount} de {items.length} completados</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Progress bar */}
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">{progress}%</span>
            </div>
            <button
              onClick={handleDismiss}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Ocultar checklist"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
                  item.done
                    ? "border-green-500/20 bg-green-500/5 opacity-70"
                    : "border-border/40 bg-muted/20 hover:bg-muted/30"
                }`}
              >
                <div className={`mt-0.5 shrink-0 ${item.done ? "text-green-500" : "text-muted-foreground"}`}>
                  {item.done ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <Circle className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${item.done ? "line-through text-muted-foreground" : ""}`}>
                    {item.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.description}</p>
                </div>
                {!item.done && (
                  <button
                    onClick={item.action}
                    className="shrink-0 text-green-400 hover:text-green-300 transition-colors mt-0.5"
                    title={item.actionLabel}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {allDone && (
          <div className="mt-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-center">
            <p className="text-sm font-semibold text-green-400">🎉 ¡Todo listo! Tu red de carga está operativa.</p>
            <button onClick={handleDismiss} className="text-xs text-muted-foreground mt-1 hover:text-foreground">
              Ocultar este panel
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
