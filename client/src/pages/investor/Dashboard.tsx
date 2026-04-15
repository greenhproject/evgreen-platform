import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Zap, MapPin, DollarSign, TrendingUp, Activity, Wallet,
  Crown, Gem, Award, Shield, Star, Building2, Users as UsersIcon,
  Sparkles,
} from "lucide-react";
import { InvestorInsights } from "@/components/InvestorInsights";
import { CollectiveInvestmentCard } from "@/components/CollectiveInvestmentCard";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area,
} from "recharts";
import { motion } from "framer-motion";

const BADGE_CONFIG: Record<string, { label: string; icon: any; gradient: string; ring: string }> = {
  emerald: { label: "Esmeralda", icon: Gem, gradient: "from-emerald-500 to-emerald-700", ring: "ring-emerald-400" },
  gold: { label: "Oro", icon: Award, gradient: "from-yellow-400 to-amber-600", ring: "ring-yellow-400" },
  platinum: { label: "Platino", icon: Shield, gradient: "from-slate-300 to-slate-500", ring: "ring-slate-300" },
  diamond: { label: "Diamante", icon: Star, gradient: "from-cyan-300 to-blue-500", ring: "ring-cyan-300" },
};

const TYPE_CONFIG: Record<string, { label: string; icon: any; desc: string }> = {
  individual: { label: "Dueño Individual", icon: Building2, desc: "Propietario de estación completa" },
  collective: { label: "Participación Colectiva", icon: UsersIcon, desc: "Participación en estación" },
  founder: { label: "Fundador", icon: Crown, desc: "Inversionista fundador" },
};

export default function InvestorDashboard() {
  const { data: stations } = trpc.stations.listOwned.useQuery();
  const { data: metrics, isLoading } = trpc.dashboard.investorMetrics.useQuery(undefined, {
    refetchInterval: 30000,
  });
  const { data: investorProfile } = trpc.investorManagement.getMyProfile.useQuery();
  const { data: platformSettings } = trpc.settings.getInvestorPercentage.useQuery();
  const investorPercentage = platformSettings?.investorPercentage ?? 80;
  const platformFeePercentage = platformSettings?.platformFeePercentage ?? 20;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(amount);

  // Determine station types for labels
  const hasIndividual = stations?.some((s: any) => s.ownershipType !== 'collective') ?? false;
  const hasCollective = investorProfile?.investorType === 'collective' || investorProfile?.investorType === 'founder';
  const stationSourceLabel = hasIndividual && hasCollective 
    ? "Todas las estaciones" 
    : hasCollective 
      ? "Estaciones colectivas" 
      : "Mis estaciones";

  const revenueData = [
    { name: "Lun", value: 0 },
    { name: "Mar", value: 0 },
    { name: "Mié", value: 0 },
    { name: "Jue", value: 0 },
    { name: "Vie", value: 0 },
    { name: "Sáb", value: 0 },
    { name: "Dom", value: metrics?.monthlyEarnings || 0 },
  ];

  const energyData = [
    { name: "00:00", kwh: 0 },
    { name: "04:00", kwh: 0 },
    { name: "08:00", kwh: 0 },
    { name: "12:00", kwh: 0 },
    { name: "16:00", kwh: 0 },
    { name: "20:00", kwh: metrics?.monthlyKwh || 0 },
  ];

  const badgeInfo = investorProfile?.investorBadge ? BADGE_CONFIG[investorProfile.investorBadge] : null;
  const typeInfo = investorProfile?.investorType ? TYPE_CONFIG[investorProfile.investorType] : null;

  if (isLoading) {
    return (
      <div className="space-y-6 p-4 sm:p-6">
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Founder Profile */}
      {investorProfile?.isFounder && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-900/30 via-orange-900/20 to-yellow-900/30 border border-amber-500/20 p-4 sm:p-6"
        >
          <div className="flex items-center gap-4">
            <div className="relative flex-shrink-0">
              <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br ${badgeInfo?.gradient || 'from-amber-500 to-orange-600'} flex items-center justify-center shadow-lg`}>
                {badgeInfo ? (
                  <badgeInfo.icon className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                ) : (
                  <Crown className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                )}
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center animate-pulse">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold">
                  {investorProfile.founderTitle || "Fundador EVGreen"}
                </h2>
                {badgeInfo && (
                  <Badge className={`bg-gradient-to-r ${badgeInfo.gradient} text-white border-0 text-xs`}>
                    <badgeInfo.icon className="w-3 h-3 mr-1" />
                    {badgeInfo.label}
                  </Badge>
                )}
              </div>
              {investorProfile.investorQuote && (
                <p className="text-sm text-muted-foreground mt-1 italic">
                  "{investorProfile.investorQuote}"
                </p>
              )}
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                {typeInfo && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <typeInfo.icon className="w-3 h-3" />
                    {typeInfo.label}
                  </span>
                )}
                {investorProfile.investorJoinedAt && (
                  <span className="text-xs text-muted-foreground">
                    Desde {new Date(investorProfile.investorJoinedAt).toLocaleDateString("es-CO", { month: "long", year: "numeric" })}
                  </span>
                )}
                {investorProfile.companyName && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    {investorProfile.companyName}
                  </span>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Header sin fundador pero con tipo */}
      {!investorProfile?.isFounder && typeInfo && (
        <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-xl">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <typeInfo.icon className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold">{typeInfo.label}</h2>
              {badgeInfo && (
                <Badge className={`bg-gradient-to-r ${badgeInfo.gradient} text-white border-0 text-xs`}>
                  <badgeInfo.icon className="w-3 h-3 mr-1" />
                  {badgeInfo.label}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{typeInfo.desc}</p>
          </div>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold">Mi Dashboard</h1>
        <p className="text-muted-foreground">
          Monitorea el rendimiento de tus {investorProfile?.investorType === "collective" ? "participaciones" : "estaciones"} en tiempo real
        </p>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-muted-foreground truncate">
                Mis ingresos ({investorPercentage}%)
              </p>
              <h3 className="text-lg sm:text-2xl font-bold mt-1 truncate">
                {formatCurrency(metrics?.monthlyEarnings || 0)}
              </h3>
              <p className="text-xs text-emerald-400 flex items-center gap-1 mt-1">
                <TrendingUp className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">Este mes</span>
              </p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-muted-foreground truncate">Energía vendida</p>
              <h3 className="text-lg sm:text-2xl font-bold mt-1">
                {(metrics?.monthlyKwh || 0).toFixed(1)} kWh
              </h3>
              <p className="text-xs text-muted-foreground mt-1">Este mes</p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-400" />
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-muted-foreground truncate">
                {investorProfile?.investorType === "collective" ? "Participaciones" : "Estaciones"}
              </p>
              <h3 className="text-lg sm:text-2xl font-bold mt-1">
                {metrics?.onlineStations || 0} / {metrics?.totalStations || 0}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">En línea</p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-muted-foreground truncate">Sesiones del mes</p>
              <h3 className="text-lg sm:text-2xl font-bold mt-1">{metrics?.monthlyTransactions || 0}</h3>
              <p className="text-xs text-muted-foreground mt-1">Cargas completadas</p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
              <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
            </div>
          </div>
        </Card>
      </div>

      {/* Balance de billetera */}
      <Card className="p-4 sm:p-6 bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Saldo disponible para retiro</p>
            <h2 className="text-3xl font-bold text-emerald-400 mt-1">
              {formatCurrency(metrics?.walletBalance || 0)}
            </h2>
            <p className="text-xs text-muted-foreground mt-2">
              Total histórico: {formatCurrency(metrics?.totalTransactions || 0)} en {metrics?.totalTransactions || 0} transacciones
            </p>
          </div>
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <Wallet className="w-8 h-8 text-emerald-400" />
          </div>
        </div>
      </Card>

      {/* Gráficos - con colores visibles y etiquetas de fuente */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm sm:text-base">Ingresos de la semana</h3>
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              {stationSourceLabel}
            </Badge>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} />
              <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} />
              <Tooltip 
                formatter={(value: number) => [formatCurrency(value), "Ingresos"]}
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                labelStyle={{ color: '#9ca3af' }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#22c55e"
                fill="rgba(34, 197, 94, 0.15)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm sm:text-base">Energía vendida (kWh)</h3>
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              {stationSourceLabel}
            </Badge>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={energyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} />
              <Tooltip 
                formatter={(value: number) => [`${value.toFixed(1)} kWh`, "Energía"]}
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                labelStyle={{ color: '#9ca3af' }}
              />
              <Line type="monotone" dataKey="kwh" stroke="#06b6d4" strokeWidth={2} dot={{ fill: '#06b6d4', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Estado de estaciones */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card className="p-4 sm:p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2 text-sm sm:text-base">
            <MapPin className="w-4 h-4" />
            Mis estaciones
          </h3>
          {stations?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No tienes estaciones registradas
            </div>
          ) : (
            <div className="space-y-3">
              {stations?.slice(0, 5).map((station) => (
                <div key={station.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <div className="font-medium">{station.name}</div>
                    <div className="text-sm text-muted-foreground">{station.city}</div>
                  </div>
                  <Badge className={station.isOnline ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}>
                    {station.isOnline ? "En línea" : "Fuera de línea"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4 sm:p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Resumen de ingresos
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-emerald-500/10 rounded-lg">
              <span className="text-sm">Ingresos brutos del mes</span>
              <span className="font-bold text-emerald-400">
                {formatCurrency(metrics?.monthlyRevenue || 0)}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-cyan-500/10 rounded-lg">
              <span className="text-sm">Tu parte ({investorPercentage}%)</span>
              <span className="font-bold text-cyan-400">
                {formatCurrency(metrics?.monthlyEarnings || 0)}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
              <span className="text-sm text-muted-foreground">Fee plataforma ({platformFeePercentage}%)</span>
              <span className="font-medium text-muted-foreground">
                {formatCurrency((metrics?.monthlyRevenue || 0) - (metrics?.monthlyEarnings || 0))}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Inversiones Colectivas */}
      <CollectiveInvestmentCard />

      {/* Insights de IA */}
      <InvestorInsights stationIds={stations?.map(s => s.id)} />
    </div>
  );
}
