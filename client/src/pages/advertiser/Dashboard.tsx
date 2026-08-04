import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { AdvertiserLayout } from "@/components/AdvertiserLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  BarChart2, Eye, MousePointer, TrendingUp, PlusCircle,
  Clock, CheckCircle, XCircle, Pause, Zap, AlertCircle,
} from "lucide-react";

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: "Borrador", color: "text-white/50", icon: Clock },
  pending_review: { label: "En revisión", color: "text-yellow-400", icon: Clock },
  approved: { label: "Aprobada", color: "text-green-400", icon: CheckCircle },
  active: { label: "Activa", color: "text-green-400", icon: CheckCircle },
  paused: { label: "Pausada", color: "text-orange-400", icon: Pause },
  completed: { label: "Completada", color: "text-blue-400", icon: CheckCircle },
  rejected: { label: "Rechazada", color: "text-red-400", icon: XCircle },
};

function MetricCard({ icon: Icon, label, value, sub, color = "text-green-400" }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div className="bg-[#0d1526] border border-white/5 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-white/50 text-sm">{label}</p>
        <div className={`w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-white/30 text-xs mt-1">{sub}</p>}
    </div>
  );
}

export default function AdvertiserDashboard() {
  const [, navigate] = useLocation();
  // @ts-ignore
  const { user, loginUrl } = useAuth();

  const { data: profile, isLoading: profileLoading } = trpc.advertiser.getProfile.useQuery(undefined, {
    enabled: !!user,
    retry: false,
  });

  const { data: metrics, isLoading: metricsLoading } = trpc.advertiser.getDashboardMetrics.useQuery(undefined, {
    enabled: !!profile,
    retry: false,
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/60 mb-4">Debes iniciar sesión para acceder al portal de anunciantes.</p>
          <a href={loginUrl}><Button className="bg-green-500 hover:bg-green-600 text-white">Iniciar sesión</Button></a>
        </div>
      </div>
    );
  }

  if (profileLoading) {
    return (
      <AdvertiserLayout title="Dashboard">
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </AdvertiserLayout>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-green-500/15 flex items-center justify-center mx-auto mb-4">
            <Zap className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="text-white text-xl font-bold mb-2">Bienvenido a EVGreen Ads</h2>
          <p className="text-white/50 mb-6">
            Para comenzar a anunciar en la plataforma, primero debes registrar tu empresa.
          </p>
          <Link href="/advertiser/register">
            <Button className="bg-green-500 hover:bg-green-600 text-white">
              Registrar mi empresa
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <AdvertiserLayout title="Dashboard">
      {/* Estado del perfil */}
      {profile.status === "pending" && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-yellow-400 font-medium text-sm">Perfil en revisión</p>
            <p className="text-white/50 text-sm">
              Tu solicitud está siendo revisada por nuestro equipo. Recibirás una notificación en 24-48 horas.
            </p>
          </div>
        </div>
      )}

      {profile.status === "rejected" && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-400 font-medium text-sm">Perfil rechazado</p>
            <p className="text-white/50 text-sm">
              {profile.adminNotes ?? "Tu solicitud fue rechazada. Contacta a soporte para más información."}
            </p>
          </div>
        </div>
      )}

      {/* Métricas */}
      {metrics && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <MetricCard icon={Eye} label="Impresiones totales" value={metrics.totalImpressions.toLocaleString()} color="text-blue-400" />
            <MetricCard icon={MousePointer} label="Clics totales" value={metrics.totalClicks.toLocaleString()} color="text-purple-400" />
            <MetricCard icon={TrendingUp} label="CTR promedio" value={`${metrics.ctr}%`} color="text-green-400" />
            <MetricCard icon={BarChart2} label="Campañas activas" value={metrics.activeCampaigns} sub={`de ${metrics.totalCampaigns} total`} color="text-orange-400" />
          </div>

          {/* Campañas recientes */}
          <div className="bg-[#0d1526] border border-white/5 rounded-xl">
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <h2 className="text-white font-semibold">Mis campañas</h2>
              {profile.status === "approved" && (
                <Link href="/advertiser/campaigns/new">
                  <Button size="sm" className="bg-green-500 hover:bg-green-600 text-white text-xs">
                    <PlusCircle className="w-3 h-3 mr-1" /> Nueva campaña
                  </Button>
                </Link>
              )}
            </div>

            {metrics.campaigns.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-white/40 mb-3">Aún no tienes campañas</p>
                {profile.status === "approved" ? (
                  <Link href="/advertiser/campaigns/new">
                    <Button className="bg-green-500 hover:bg-green-600 text-white text-sm">
                      Crear primera campaña
                    </Button>
                  </Link>
                ) : (
                  <p className="text-white/30 text-sm">Podrás crear campañas una vez que tu perfil sea aprobado.</p>
                )}
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {metrics.campaigns.map((c) => {
                  const statusInfo = STATUS_MAP[c.status ?? "draft"] ?? STATUS_MAP.draft;
                  const StatusIcon = statusInfo.icon;
                  const ctr = (c.impressions ?? 0) > 0
                    ? (((c.clicks ?? 0) / (c.impressions ?? 1)) * 100).toFixed(1)
                    : "0.0";
                  return (
                    <Link key={c.id} href={`/advertiser/campaigns/${c.id}`}>
                      <div className="flex items-center justify-between p-4 hover:bg-white/3 cursor-pointer transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                            <StatusIcon className={`w-4 h-4 ${statusInfo.color}`} />
                          </div>
                          <div>
                            <p className="text-white text-sm font-medium">{c.name}</p>
                            <p className={`text-xs ${statusInfo.color}`}>{statusInfo.label}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6 text-right">
                          <div className="hidden md:block">
                            <p className="text-white/60 text-xs">Impresiones</p>
                            <p className="text-white text-sm font-medium">{(c.impressions ?? 0).toLocaleString()}</p>
                          </div>
                          <div className="hidden md:block">
                            <p className="text-white/60 text-xs">CTR</p>
                            <p className="text-white text-sm font-medium">{ctr}%</p>
                          </div>
                          <div>
                            <p className="text-white/60 text-xs">Presupuesto</p>
                            <p className="text-white text-sm font-medium">${(c.budgetTotal ?? 0).toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </AdvertiserLayout>
  );
}
