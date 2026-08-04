import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import {
  CheckCircle, XCircle, Clock, Building2, Mail, Phone,
  Globe, DollarSign, ChevronDown, ChevronUp, Megaphone,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  pending: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  approved: "text-green-400 bg-green-500/10 border-green-500/20",
  rejected: "text-red-400 bg-red-500/10 border-red-500/20",
  suspended: "text-orange-400 bg-orange-500/10 border-orange-500/20",
};

const CAMPAIGN_STATUS_COLORS: Record<string, string> = {
  pending_review: "text-yellow-400 bg-yellow-500/10",
  active: "text-green-400 bg-green-500/10",
  rejected: "text-red-400 bg-red-500/10",
  draft: "text-white/40 bg-white/5",
};

function AdvertiserCard({ advertiser }: { advertiser: any }) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState("");
  const utils = trpc.useUtils();

  const approveMutation = trpc.adminAdvertiser.approveAdvertiser.useMutation({
    onSuccess: () => {
      utils.adminAdvertiser.listAdvertisers.invalidate();
      toast({ title: "Anunciante aprobado" });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const rejectMutation = trpc.adminAdvertiser.rejectAdvertiser.useMutation({
    onSuccess: () => {
      utils.adminAdvertiser.listAdvertisers.invalidate();
      toast({ title: "Anunciante rechazado" });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="bg-[#0d1526] border border-white/5 rounded-xl overflow-hidden">
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/3 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-white/40" />
          </div>
          <div>
            <p className="text-white font-medium text-sm">{advertiser.companyName}</p>
            <p className="text-white/40 text-xs">{advertiser.userName} · {advertiser.userEmail}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[advertiser.status] ?? "text-white/40 bg-white/5 border-white/10"}`}>
            {advertiser.status === "pending" ? "Pendiente" :
             advertiser.status === "approved" ? "Aprobado" :
             advertiser.status === "rejected" ? "Rechazado" : advertiser.status}
          </span>
          {expanded ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-white/5 p-4">
          <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
            {advertiser.industry && (
              <div>
                <p className="text-white/40 text-xs">Industria</p>
                <p className="text-white">{advertiser.industry}</p>
              </div>
            )}
            {advertiser.monthlyBudget && (
              <div>
                <p className="text-white/40 text-xs">Presupuesto mensual</p>
                <p className="text-white">${advertiser.monthlyBudget.toLocaleString()} COP</p>
              </div>
            )}
            {advertiser.contactEmail && (
              <div>
                <p className="text-white/40 text-xs">Email de contacto</p>
                <p className="text-white">{advertiser.contactEmail}</p>
              </div>
            )}
            <div>
              <p className="text-white/40 text-xs">Registrado</p>
              <p className="text-white">{new Date(advertiser.createdAt).toLocaleDateString("es-CO")}</p>
            </div>
          </div>

          {advertiser.status === "pending" && (
            <div>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas (opcional para aprobación, requerido para rechazo)..."
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 text-sm resize-none mb-3"
                rows={2}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="bg-green-500 hover:bg-green-600 text-white text-xs"
                  onClick={() => approveMutation.mutate({ profileId: advertiser.id, notes: notes || undefined })}
                  disabled={approveMutation.isPending}
                >
                  <CheckCircle className="w-3 h-3 mr-1" /> Aprobar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs"
                  onClick={() => {
                    if (!notes.trim()) {
                      toast({ title: "Error", description: "Debes indicar el motivo del rechazo.", variant: "destructive" });
                      return;
                    }
                    rejectMutation.mutate({ profileId: advertiser.id, notes });
                  }}
                  disabled={rejectMutation.isPending}
                >
                  <XCircle className="w-3 h-3 mr-1" /> Rechazar
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CampaignReviewCard({ campaign }: { campaign: any }) {
  const [notes, setNotes] = useState("");
  const utils = trpc.useUtils();

  const approveMutation = trpc.adminAdvertiser.approveCampaign.useMutation({
    onSuccess: () => {
      utils.adminAdvertiser.listPendingCampaigns.invalidate();
      toast({ title: "Campaña aprobada y activada" });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const rejectMutation = trpc.adminAdvertiser.rejectCampaign.useMutation({
    onSuccess: () => {
      utils.adminAdvertiser.listPendingCampaigns.invalidate();
      toast({ title: "Campaña rechazada" });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="bg-[#0d1526] border border-white/5 rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-white font-medium text-sm">{campaign.name}</p>
          <p className="text-white/40 text-xs">{campaign.companyName} · {campaign.objective}</p>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full text-yellow-400 bg-yellow-500/10">En revisión</span>
      </div>
      <div className="flex items-center gap-4 text-xs text-white/40 mb-3">
        <span>Presupuesto: <span className="text-white">${(campaign.budgetTotal ?? 0).toLocaleString()} COP</span></span>
        <span>Creada: {new Date(campaign.createdAt).toLocaleDateString("es-CO")}</span>
      </div>
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notas de revisión (requerido para rechazo)..."
        className="bg-white/5 border-white/10 text-white placeholder:text-white/30 text-sm resize-none mb-3"
        rows={2}
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          className="bg-green-500 hover:bg-green-600 text-white text-xs"
          onClick={() => approveMutation.mutate({ campaignId: campaign.id, notes: notes || undefined })}
          disabled={approveMutation.isPending}
        >
          <CheckCircle className="w-3 h-3 mr-1" /> Aprobar y activar
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs"
          onClick={() => {
            if (!notes.trim()) {
              toast({ title: "Error", description: "Debes indicar el motivo del rechazo.", variant: "destructive" });
              return;
            }
            rejectMutation.mutate({ campaignId: campaign.id, notes });
          }}
          disabled={rejectMutation.isPending}
        >
          <XCircle className="w-3 h-3 mr-1" /> Rechazar
        </Button>
      </div>
    </div>
  );
}

export default function AdminAdvertisers() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"advertisers" | "campaigns">("advertisers");

  const { data: advertisers, isLoading: loadingAdvertisers } = trpc.adminAdvertiser.listAdvertisers.useQuery(undefined, {
    enabled: !!user && (user.role === "admin" || user.role === "staff"),
  });

  const { data: pendingCampaigns, isLoading: loadingCampaigns } = trpc.adminAdvertiser.listPendingCampaigns.useQuery(undefined, {
    enabled: !!user && (user.role === "admin" || user.role === "staff"),
  });

  if (!user || (user.role !== "admin" && user.role !== "staff")) {
    return (
      <div className="p-8 text-center">
        <p className="text-white/40">Acceso restringido a administradores.</p>
      </div>
    );
  }

  const pendingAdvertisers = advertisers?.filter(a => a.status === "pending") ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-white text-lg font-semibold">Gestión de Anunciantes</h2>
        <div className="flex gap-2">
          {pendingAdvertisers.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">
              {pendingAdvertisers.length} pendiente{pendingAdvertisers.length !== 1 ? "s" : ""}
            </span>
          )}
          {(pendingCampaigns?.length ?? 0) > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400">
              {pendingCampaigns?.length} campaña{(pendingCampaigns?.length ?? 0) !== 1 ? "s" : ""} en revisión
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white/5 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab("advertisers")}
          className={`px-4 py-1.5 rounded-md text-sm transition-all ${tab === "advertisers" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"}`}
        >
          Anunciantes ({advertisers?.length ?? 0})
        </button>
        <button
          onClick={() => setTab("campaigns")}
          className={`px-4 py-1.5 rounded-md text-sm transition-all ${tab === "campaigns" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"}`}
        >
          Campañas en revisión ({pendingCampaigns?.length ?? 0})
        </button>
      </div>

      {tab === "advertisers" && (
        <div className="space-y-3">
          {loadingAdvertisers ? (
            <div className="flex items-center justify-center h-20">
              <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !advertisers || advertisers.length === 0 ? (
            <div className="text-center py-8 text-white/30">No hay anunciantes registrados.</div>
          ) : (
            advertisers.map((a) => <AdvertiserCard key={a.id} advertiser={a} />)
          )}
        </div>
      )}

      {tab === "campaigns" && (
        <div className="space-y-3">
          {loadingCampaigns ? (
            <div className="flex items-center justify-center h-20">
              <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !pendingCampaigns || pendingCampaigns.length === 0 ? (
            <div className="text-center py-8 text-white/30">No hay campañas pendientes de revisión.</div>
          ) : (
            pendingCampaigns.map((c) => <CampaignReviewCard key={c.id} campaign={c} />)
          )}
        </div>
      )}
    </div>
  );
}
