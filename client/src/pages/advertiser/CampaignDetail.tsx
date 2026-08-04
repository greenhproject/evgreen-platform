import { useState } from "react";
import { useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { AdvertiserLayout } from "@/components/AdvertiserLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft, PlusCircle, Trash2, Eye, MousePointer, TrendingUp,
  CheckCircle, Clock, XCircle, Pause, Send, Image, ExternalLink,
} from "lucide-react";

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: "Borrador", color: "text-white/50", bg: "bg-white/5" },
  pending_review: { label: "En revisión", color: "text-yellow-400", bg: "bg-yellow-500/10" },
  active: { label: "Activa", color: "text-green-400", bg: "bg-green-500/10" },
  paused: { label: "Pausada", color: "text-orange-400", bg: "bg-orange-500/10" },
  completed: { label: "Completada", color: "text-blue-400", bg: "bg-blue-500/10" },
  rejected: { label: "Rechazada", color: "text-red-400", bg: "bg-red-500/10" },
};

const FORMATS = [
  { value: "PROMOTIONAL", label: "Promocional" },
  { value: "SPLASH", label: "Splash (pantalla completa)" },
  { value: "CHARGING", label: "Durante la carga" },
  { value: "MAP", label: "En el mapa" },
];

interface CreativeForm {
  format: string;
  imageUrl: string;
  title: string;
  subtitle: string;
  body: string;
  ctaText: string;
  linkUrl: string;
}

export default function CampaignDetail({ id }: { id: string }) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [showCreativeForm, setShowCreativeForm] = useState(false);
  const [creativeForm, setCreativeForm] = useState<CreativeForm>({
    format: "PROMOTIONAL",
    imageUrl: "",
    title: "",
    subtitle: "",
    body: "",
    ctaText: "Ver más",
    linkUrl: "",
  });

  const campaignId = parseInt(id);

  const { data: campaign, isLoading } = trpc.advertiser.getCampaign.useQuery(
    { id: campaignId },
    { enabled: !!user && !isNaN(campaignId), retry: false }
  );

  const addCreativeMutation = trpc.advertiser.addCreative.useMutation({
    onSuccess: () => {
      utils.advertiser.getCampaign.invalidate({ id: campaignId });
      setShowCreativeForm(false);
      setCreativeForm({ format: "PROMOTIONAL", imageUrl: "", title: "", subtitle: "", body: "", ctaText: "Ver más", linkUrl: "" });
      toast.success("Creatividad agregada");
    },
    onError: (err) => toast.error("Error: " + String(err.message)),
  });

  const deleteCreativeMutation = trpc.advertiser.deleteCreative.useMutation({
    onSuccess: () => {
      utils.advertiser.getCampaign.invalidate({ id: campaignId });
      toast.success("Creatividad eliminada");
    },
    onError: (err) => toast.error("Error: " + String(err.message)),
  });

  const submitMutation = trpc.advertiser.submitForReview.useMutation({
    onSuccess: () => {
      utils.advertiser.getCampaign.invalidate({ id: campaignId });
      toast.success("Campaña enviada a revisión: Nuestro equipo la revisará en 24-48 horas.");
    },
    onError: (err) => toast.error("Error: " + String(err.message)),
  });

  const pauseMutation = trpc.advertiser.pauseCampaign.useMutation({
    onSuccess: () => {
      utils.advertiser.getCampaign.invalidate({ id: campaignId });
      toast.success("Campaña pausada");
    },
    onError: (err) => toast.error("Error: " + String(err.message)),
  });

  if (isLoading) {
    return (
      <AdvertiserLayout title="Campaña">
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </AdvertiserLayout>
    );
  }

  if (!campaign) {
    return (
      <AdvertiserLayout title="Campaña no encontrada">
        <div className="text-center py-12">
          <p className="text-white/40 mb-4">No se encontró la campaña.</p>
          <Link href="/advertiser/campaigns">
            <Button variant="outline" className="border-white/10 text-white/60">
              <ArrowLeft className="w-4 h-4 mr-2" /> Volver a campañas
            </Button>
          </Link>
        </div>
      </AdvertiserLayout>
    );
  }

  const s = STATUS_MAP[campaign.status ?? "draft"] ?? STATUS_MAP.draft;
  const ctr = (campaign.impressions ?? 0) > 0
    ? (((campaign.clicks ?? 0) / (campaign.impressions ?? 1)) * 100).toFixed(1)
    : "0.0";
  const canEdit = ["draft", "paused"].includes(campaign.status ?? "");

  return (
    <AdvertiserLayout title={campaign.name}>
      {/* Back + status */}
      <div className="flex items-center justify-between mb-6">
        <Link href="/advertiser/campaigns">
          <Button variant="ghost" size="sm" className="text-white/40 hover:text-white/70 -ml-2">
            <ArrowLeft className="w-4 h-4 mr-1" /> Campañas
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <span className={`text-sm px-3 py-1 rounded-full ${s.bg} ${s.color}`}>{s.label}</span>
          {campaign.status === "draft" && (
            <Button
              size="sm"
              className="bg-green-500 hover:bg-green-600 text-white text-xs"
              onClick={() => submitMutation.mutate({ id: campaignId })}
              disabled={submitMutation.isPending}
            >
              <Send className="w-3 h-3 mr-1" /> Enviar a revisión
            </Button>
          )}
          {campaign.status === "active" && (
            <Button
              size="sm"
              variant="outline"
              className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10 text-xs"
              onClick={() => pauseMutation.mutate({ id: campaignId })}
              disabled={pauseMutation.isPending}
            >
              <Pause className="w-3 h-3 mr-1" /> Pausar
            </Button>
          )}
        </div>
      </div>

      {/* Admin notes */}
      {campaign.adminNotes && campaign.status === "rejected" && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
          <p className="text-red-400 font-medium text-sm mb-1">Motivo de rechazo</p>
          <p className="text-white/60 text-sm">{campaign.adminNotes}</p>
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { icon: Eye, label: "Impresiones", value: (campaign.impressions ?? 0).toLocaleString(), color: "text-blue-400" },
          { icon: MousePointer, label: "Clics", value: (campaign.clicks ?? 0).toLocaleString(), color: "text-purple-400" },
          { icon: TrendingUp, label: "CTR", value: `${ctr}%`, color: "text-green-400" },
        ].map((m) => (
          <div key={m.label} className="bg-[#0d1526] border border-white/5 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <m.icon className={`w-4 h-4 ${m.color}`} />
              <p className="text-white/50 text-xs">{m.label}</p>
            </div>
            <p className={`text-xl font-bold ${m.color}`}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Campaign details */}
      <div className="bg-[#0d1526] border border-white/5 rounded-xl p-5 mb-6">
        <h3 className="text-white font-semibold mb-4">Detalles de la campaña</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          {[
            { label: "Objetivo", value: campaign.objective },
            { label: "Presupuesto total", value: `$${(campaign.budgetTotal ?? 0).toLocaleString()} COP` },
            { label: "Presupuesto gastado", value: `$${(campaign.budgetSpent ?? 0).toLocaleString()} COP` },
            // @ts-ignore
            { label: "Ciudades", value: campaign.targetCities?.join(", ") || "Todas" },
            // @ts-ignore
            { label: "Marcas", value: campaign.targetVehicleBrands?.join(", ") || "Todas" },
            { label: "Inicio", value: campaign.startDate || "Inmediato" },
            { label: "Fin", value: campaign.endDate || "Sin límite" },
          ].map((item) => (
            <div key={item.label}>
              <p className="text-white/40 text-xs">{item.label}</p>
              <p className="text-white capitalize">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Creatives */}
      <div className="bg-[#0d1526] border border-white/5 rounded-xl">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h3 className="text-white font-semibold">Creatividades</h3>
          {canEdit && (
            <Button
              size="sm"
              variant="outline"
              className="border-white/10 text-white/60 hover:bg-white/5 text-xs"
              onClick={() => setShowCreativeForm(!showCreativeForm)}
            >
              <PlusCircle className="w-3 h-3 mr-1" /> Agregar
            </Button>
          )}
        </div>

        {/* Creative form */}
        {showCreativeForm && (
          <div className="p-5 border-b border-white/5 bg-white/2">
            <p className="text-white font-medium text-sm mb-4">Nueva creatividad</p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <Label className="text-white/70 text-xs">Formato</Label>
                <Select value={creativeForm.format} onValueChange={(v) => setCreativeForm({ ...creativeForm, format: v })}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white mt-1 h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMATS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-white/70 text-xs">URL de imagen *</Label>
                <Input
                  value={creativeForm.imageUrl}
                  onChange={(e) => setCreativeForm({ ...creativeForm, imageUrl: e.target.value })}
                  placeholder="https://..."
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 mt-1 h-9 text-sm"
                />
              </div>
              <div>
                <Label className="text-white/70 text-xs">Título *</Label>
                <Input
                  value={creativeForm.title}
                  onChange={(e) => setCreativeForm({ ...creativeForm, title: e.target.value })}
                  className="bg-white/5 border-white/10 text-white mt-1 h-9 text-sm"
                />
              </div>
              <div>
                <Label className="text-white/70 text-xs">Subtítulo</Label>
                <Input
                  value={creativeForm.subtitle}
                  onChange={(e) => setCreativeForm({ ...creativeForm, subtitle: e.target.value })}
                  className="bg-white/5 border-white/10 text-white mt-1 h-9 text-sm"
                />
              </div>
              <div>
                <Label className="text-white/70 text-xs">Texto del botón</Label>
                <Input
                  value={creativeForm.ctaText}
                  onChange={(e) => setCreativeForm({ ...creativeForm, ctaText: e.target.value })}
                  className="bg-white/5 border-white/10 text-white mt-1 h-9 text-sm"
                />
              </div>
              <div>
                <Label className="text-white/70 text-xs">URL de destino</Label>
                <Input
                  value={creativeForm.linkUrl}
                  onChange={(e) => setCreativeForm({ ...creativeForm, linkUrl: e.target.value })}
                  placeholder="https://..."
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 mt-1 h-9 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="bg-green-500 hover:bg-green-600 text-white text-xs"
                onClick={() => {
                  if (!creativeForm.imageUrl || !creativeForm.title) {
                    toast.error("Error: " + String("URL de imagen y título son requeridos."));
                    return;
                  }
                  addCreativeMutation.mutate({
                    campaignId,
                    format: creativeForm.format as any,
                    imageUrl: creativeForm.imageUrl,
                    title: creativeForm.title,
                    subtitle: creativeForm.subtitle || undefined,
                    body: creativeForm.body || undefined,
                    ctaText: creativeForm.ctaText || undefined,
                    linkUrl: creativeForm.linkUrl || undefined,
                  });
                }}
                disabled={addCreativeMutation.isPending}
              >
                Guardar creatividad
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-white/40 text-xs"
                onClick={() => setShowCreativeForm(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Creatives list */}
        {campaign.creatives?.length === 0 ? (
          <div className="p-8 text-center">
            <Image className="w-8 h-8 text-white/20 mx-auto mb-2" />
            <p className="text-white/30 text-sm">No hay creatividades aún</p>
            {canEdit && (
              <p className="text-white/20 text-xs mt-1">Agrega al menos una para poder enviar a revisión.</p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {campaign.creatives?.map((creative: any) => (
              <div key={creative.id} className="flex items-center gap-4 p-4">
                <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {creative.imageUrl ? (
                    <img src={creative.imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Image className="w-5 h-5 text-white/20" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{creative.title}</p>
                  <p className="text-white/40 text-xs">{FORMATS.find(f => f.value === creative.format)?.label ?? creative.format}</p>
                </div>
                <div className="flex items-center gap-2">
                  {creative.linkUrl && (
                    <a href={creative.linkUrl} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="ghost" className="text-white/30 hover:text-white/60 h-7 w-7 p-0">
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                    </a>
                  )}
                  {canEdit && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-400/50 hover:text-red-400 h-7 w-7 p-0"
                      onClick={() => deleteCreativeMutation.mutate({ id: creative.id })}
                      disabled={deleteCreativeMutation.isPending}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdvertiserLayout>
  );
}
