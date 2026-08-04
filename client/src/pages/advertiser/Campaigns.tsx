import { useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { AdvertiserLayout } from "@/components/AdvertiserLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  PlusCircle, Clock, CheckCircle, XCircle, Pause,
  Eye, MousePointer, TrendingUp, ChevronRight,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: "Borrador", color: "text-white/50", bg: "bg-white/5" },
  pending_review: { label: "En revisión", color: "text-yellow-400", bg: "bg-yellow-500/10" },
  active: { label: "Activa", color: "text-green-400", bg: "bg-green-500/10" },
  paused: { label: "Pausada", color: "text-orange-400", bg: "bg-orange-500/10" },
  completed: { label: "Completada", color: "text-blue-400", bg: "bg-blue-500/10" },
  rejected: { label: "Rechazada", color: "text-red-400", bg: "bg-red-500/10" },
};

export default function AdvertiserCampaigns() {
  const { user, loginUrl } = useAuth();
  const utils = trpc.useUtils();

  const { data: profile } = trpc.advertiser.getProfile.useQuery(undefined, {
    enabled: !!user, retry: false,
  });

  const { data: campaigns, isLoading } = trpc.advertiser.listCampaigns.useQuery(undefined, {
    enabled: !!profile, retry: false,
  });

  const pauseMutation = trpc.advertiser.pauseCampaign.useMutation({
    onSuccess: () => {
      utils.advertiser.listCampaigns.invalidate();
      toast({ title: "Campaña pausada" });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const submitMutation = trpc.advertiser.submitForReview.useMutation({
    onSuccess: () => {
      utils.advertiser.listCampaigns.invalidate();
      toast({ title: "Campaña enviada a revisión" });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center">
        <a href={loginUrl}><Button className="bg-green-500 hover:bg-green-600 text-white">Iniciar sesión</Button></a>
      </div>
    );
  }

  return (
    <AdvertiserLayout title="Mis Campañas">
      <div className="flex justify-between items-center mb-6">
        <p className="text-white/50 text-sm">
          {campaigns?.length ?? 0} campaña{campaigns?.length !== 1 ? "s" : ""} en total
        </p>
        {profile?.status === "approved" && (
          <Link href="/advertiser/campaigns/new">
            <Button className="bg-green-500 hover:bg-green-600 text-white text-sm">
              <PlusCircle className="w-4 h-4 mr-2" /> Nueva campaña
            </Button>
          </Link>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !campaigns || campaigns.length === 0 ? (
        <div className="bg-[#0d1526] border border-white/5 rounded-xl p-12 text-center">
          <p className="text-white/40 mb-4">Aún no tienes campañas</p>
          {profile?.status === "approved" ? (
            <Link href="/advertiser/campaigns/new">
              <Button className="bg-green-500 hover:bg-green-600 text-white">Crear primera campaña</Button>
            </Link>
          ) : (
            <p className="text-white/30 text-sm">Tu perfil debe ser aprobado antes de crear campañas.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => {
            const s = STATUS_MAP[c.status ?? "draft"] ?? STATUS_MAP.draft;
            const ctr = (c.impressions ?? 0) > 0
              ? (((c.clicks ?? 0) / (c.impressions ?? 1)) * 100).toFixed(1)
              : "0.0";
            return (
              <div key={c.id} className="bg-[#0d1526] border border-white/5 rounded-xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-white font-semibold truncate">{c.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${s.bg} ${s.color} whitespace-nowrap`}>
                        {s.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm">
                      <div className="flex items-center gap-1.5 text-white/50">
                        <Eye className="w-3.5 h-3.5" />
                        <span>{(c.impressions ?? 0).toLocaleString()} impresiones</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-white/50">
                        <MousePointer className="w-3.5 h-3.5" />
                        <span>{(c.clicks ?? 0).toLocaleString()} clics</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-white/50">
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>CTR {ctr}%</span>
                      </div>
                      <div className="text-white/50">
                        Presupuesto: <span className="text-white">${(c.budgetTotal ?? 0).toLocaleString()} COP</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {c.status === "draft" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-green-500/30 text-green-400 hover:bg-green-500/10 text-xs"
                        onClick={() => submitMutation.mutate({ id: c.id })}
                        disabled={submitMutation.isPending}
                      >
                        Enviar a revisión
                      </Button>
                    )}
                    {c.status === "active" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10 text-xs"
                        onClick={() => pauseMutation.mutate({ id: c.id })}
                        disabled={pauseMutation.isPending}
                      >
                        Pausar
                      </Button>
                    )}
                    <Link href={`/advertiser/campaigns/${c.id}`}>
                      <Button size="sm" variant="ghost" className="text-white/40 hover:text-white">
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AdvertiserLayout>
  );
}
