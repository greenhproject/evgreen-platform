import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Ban,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  Clock3,
  FileText,
  Globe,
  History,
  Mail,
  Megaphone,
  Phone,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from "lucide-react";

type ProfileStatus = "pending" | "approved" | "rejected" | "suspended";
type Decision = "approve" | "reject" | "suspend";

const STATUS_CONFIG: Record<ProfileStatus, { label: string; className: string }> = {
  pending: { label: "Pendiente", className: "border-amber-500/30 bg-amber-500/10 text-amber-300" },
  approved: { label: "Aprobado", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" },
  rejected: { label: "Rechazado", className: "border-red-500/30 bg-red-500/10 text-red-300" },
  suspended: { label: "Suspendido", className: "border-orange-500/30 bg-orange-500/10 text-orange-300" },
};

const DECISION_CONFIG: Record<Decision, { label: string; verb: string; requiresNotes: boolean; className: string }> = {
  approve: { label: "Aprobar perfil", verb: "aprobar", requiresNotes: false, className: "bg-emerald-600 hover:bg-emerald-500 text-white" },
  reject: { label: "Rechazar perfil", verb: "rechazar", requiresNotes: true, className: "bg-red-600 hover:bg-red-500 text-white" },
  suspend: { label: "Suspender perfil", verb: "suspender", requiresNotes: true, className: "bg-orange-600 hover:bg-orange-500 text-white" },
};

function formatDate(value?: string | Date | null) {
  if (!value) return "Sin registro";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Sin registro"
    : date.toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

function formatCop(value?: number | null) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

function StatusBadge({ status }: { status: ProfileStatus }) {
  const config = STATUS_CONFIG[status];
  return <Badge className={`border px-2 py-0.5 font-medium ${config.className}`}>{config.label}</Badge>;
}

function AdvertiserReviewCard({ advertiser, reviewEvents }: { advertiser: any; reviewEvents: any[] }) {
  const [expanded, setExpanded] = useState(advertiser.status === "pending");
  const [notes, setNotes] = useState("");
  const [decision, setDecision] = useState<Decision | null>(null);
  const utils = trpc.useUtils();

  const finishDecision = (message: string) => {
    utils.adminAdvertiser.listAdvertisers.invalidate();
    utils.adminAdvertiser.listAdvertiserReviewEvents.invalidate();
    toast.success(message);
    setNotes("");
    setDecision(null);
  };

  const approveMutation = trpc.adminAdvertiser.approveAdvertiser.useMutation({
    onSuccess: () => finishDecision("Perfil de anunciante aprobado"),
    onError: (error) => toast.error(error.message),
  });
  const rejectMutation = trpc.adminAdvertiser.rejectAdvertiser.useMutation({
    onSuccess: () => finishDecision("Perfil de anunciante rechazado"),
    onError: (error) => toast.error(error.message),
  });
  const suspendMutation = trpc.adminAdvertiser.suspendAdvertiser.useMutation({
    onSuccess: () => finishDecision("Perfil de anunciante suspendido"),
    onError: (error) => toast.error(error.message),
  });

  const profileEvents = reviewEvents.filter((event) => event.profileId === advertiser.id);
  const isMutating = approveMutation.isPending || rejectMutation.isPending || suspendMutation.isPending;
  const currentDecision = decision ? DECISION_CONFIG[decision] : null;
  const normalizedNotes = notes.trim();

  const requestDecision = (nextDecision: Decision) => {
    if (DECISION_CONFIG[nextDecision].requiresNotes && normalizedNotes.length < 3) {
      toast.error("Indica un motivo de al menos 3 caracteres para continuar.");
      return;
    }
    setDecision(nextDecision);
  };

  const executeDecision = () => {
    if (!decision) return;
    const payload = { profileId: advertiser.id, notes: normalizedNotes || undefined };
    if (decision === "approve") {
      approveMutation.mutate(payload);
      return;
    }
    if (decision === "reject") {
      rejectMutation.mutate({ ...payload, notes: normalizedNotes });
      return;
    }
    suspendMutation.mutate({ ...payload, notes: normalizedNotes });
  };

  const canApprove = ["pending", "rejected", "suspended"].includes(advertiser.status);
  const canReject = advertiser.status === "pending";
  const canSuspend = advertiser.status === "approved";

  return (
    <article className={`overflow-hidden rounded-2xl border bg-[#0d1526] ${advertiser.status === "pending" ? "border-amber-500/30" : "border-white/10"}`}>
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="flex w-full items-start justify-between gap-3 p-4 text-left transition-colors hover:bg-white/[0.03] sm:items-center"
        aria-expanded={expanded}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5">
            <Building2 className="h-5 w-5 text-white/60" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{advertiser.companyName}</p>
            <p className="truncate text-xs text-white/50">{advertiser.contactName || advertiser.userName || "Sin contacto"} · {advertiser.contactEmail || advertiser.userEmail || "Sin correo"}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge status={advertiser.status as ProfileStatus} />
          {expanded ? <ChevronUp className="h-4 w-4 text-white/50" /> : <ChevronDown className="h-4 w-4 text-white/50" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-white/10 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl bg-white/[0.035] p-3">
              <p className="text-xs text-white/45">Industria</p>
              <p className="mt-1 text-sm text-white">{advertiser.industry || "No especificada"}</p>
            </div>
            <div className="rounded-xl bg-white/[0.035] p-3">
              <p className="text-xs text-white/45">Presupuesto mensual</p>
              <p className="mt-1 text-sm text-white">{advertiser.monthlyBudget ? formatCop(advertiser.monthlyBudget) : "No reportado"}</p>
            </div>
            <div className="rounded-xl bg-white/[0.035] p-3">
              <p className="text-xs text-white/45">Registro</p>
              <p className="mt-1 text-sm text-white">{formatDate(advertiser.createdAt)}</p>
            </div>
            <div className="rounded-xl bg-white/[0.035] p-3">
              <p className="text-xs text-white/45">Última aprobación</p>
              <p className="mt-1 text-sm text-white">{advertiser.approvedAt ? formatDate(advertiser.approvedAt) : "Sin aprobación"}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 text-sm text-white/75 sm:grid-cols-2">
            <div className="space-y-2 rounded-xl border border-white/10 p-3">
              <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-white/45"><Mail className="h-3.5 w-3.5" /> Contacto</p>
              <p>{advertiser.contactEmail || advertiser.userEmail || "No disponible"}</p>
              <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-white/45" /> {advertiser.contactPhone || "Teléfono no reportado"}</p>
            </div>
            <div className="space-y-2 rounded-xl border border-white/10 p-3">
              <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-white/45"><FileText className="h-3.5 w-3.5" /> Empresa</p>
              <p>NIT: {advertiser.taxId || "No reportado"}</p>
              {advertiser.website ? <a className="flex items-center gap-2 text-emerald-300 underline-offset-2 hover:underline" href={advertiser.website} target="_blank" rel="noreferrer"><Globe className="h-3.5 w-3.5" /> Sitio web</a> : <p>Sitio web no reportado</p>}
            </div>
          </div>

          {(canApprove || canReject || canSuspend) && (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.025] p-3">
              <p className="mb-2 flex items-center gap-2 text-sm font-medium text-white"><ShieldCheck className="h-4 w-4 text-emerald-300" /> Decisión administrativa</p>
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
                maxLength={2000}
                placeholder={canReject || canSuspend ? "Motivo obligatorio para rechazar o suspender…" : "Notas internas opcionales para la aprobación…"}
                className="border-white/10 bg-black/20 text-white placeholder:text-white/35"
              />
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {canApprove && <Button size="sm" onClick={() => requestDecision("approve")} disabled={isMutating} className="bg-emerald-600 text-white hover:bg-emerald-500"><CheckCircle2 className="mr-1.5 h-4 w-4" />{advertiser.status === "pending" ? "Aprobar" : "Reaprobar"}</Button>}
                {canReject && <Button size="sm" variant="outline" onClick={() => requestDecision("reject")} disabled={isMutating} className="border-red-500/40 text-red-300 hover:bg-red-500/10 hover:text-red-200"><XCircle className="mr-1.5 h-4 w-4" />Rechazar</Button>}
                {canSuspend && <Button size="sm" variant="outline" onClick={() => requestDecision("suspend")} disabled={isMutating} className="border-orange-500/40 text-orange-300 hover:bg-orange-500/10 hover:text-orange-200"><Ban className="mr-1.5 h-4 w-4" />Suspender</Button>}
              </div>
            </div>
          )}

          <div className="mt-4 rounded-xl border border-white/10 p-3">
            <p className="mb-3 flex items-center gap-2 text-sm font-medium text-white"><History className="h-4 w-4 text-blue-300" /> Historial de decisiones</p>
            {profileEvents.length === 0 ? (
              <p className="text-sm text-white/45">Aún no hay decisiones registradas para este perfil.</p>
            ) : (
              <ol className="space-y-3">
                {profileEvents.map((event) => (
                  <li key={event.id} className="border-l border-white/15 pl-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={event.action as ProfileStatus} />
                      <span className="text-xs text-white/45">{formatDate(event.createdAt)} · Admin #{event.actorId}</span>
                    </div>
                    {event.notes && <p className="mt-1 text-white/70">{event.notes}</p>}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}

      <AlertDialog open={decision !== null} onOpenChange={(open) => !open && setDecision(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{currentDecision?.label}</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a {currentDecision?.verb} el perfil de <strong>{advertiser.companyName}</strong>. Esta decisión se guardará en la bitácora administrativa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMutating}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={executeDecision} disabled={isMutating} className={currentDecision?.className}>
              {isMutating ? "Guardando…" : "Confirmar decisión"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}

function CampaignReviewCard({ campaign }: { campaign: any }) {
  const [notes, setNotes] = useState("");
  const utils = trpc.useUtils();
  const approveMutation = trpc.adminAdvertiser.approveCampaign.useMutation({
    onSuccess: () => { utils.adminAdvertiser.listPendingCampaigns.invalidate(); toast.success("Campaña aprobada y activada"); },
    onError: (error) => toast.error(error.message),
  });
  const rejectMutation = trpc.adminAdvertiser.rejectCampaign.useMutation({
    onSuccess: () => { utils.adminAdvertiser.listPendingCampaigns.invalidate(); toast.success("Campaña rechazada"); },
    onError: (error) => toast.error(error.message),
  });
  const isMutating = approveMutation.isPending || rejectMutation.isPending;
  const reject = () => {
    if (notes.trim().length < 3) return toast.error("El motivo de rechazo debe tener al menos 3 caracteres.");
    rejectMutation.mutate({ campaignId: campaign.id, notes: notes.trim() });
  };

  return (
    <article className="rounded-2xl border border-white/10 bg-[#0d1526] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold text-white">{campaign.name}</p>
          <p className="text-sm text-white/55">{campaign.companyName} · {campaign.objective}</p>
        </div>
        <Badge className="w-fit border border-amber-500/30 bg-amber-500/10 text-amber-300">En revisión</Badge>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/60">
        <span className="flex items-center gap-1.5"><CircleDollarSign className="h-4 w-4" /> {formatCop(campaign.budgetTotal)}</span>
        <span className="flex items-center gap-1.5"><Clock3 className="h-4 w-4" /> {formatDate(campaign.createdAt)}</span>
      </div>
      <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} placeholder="Notas internas (obligatorias para rechazar)…" className="mt-3 border-white/10 bg-black/20 text-white placeholder:text-white/35" />
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Button size="sm" onClick={() => approveMutation.mutate({ campaignId: campaign.id, notes: notes.trim() || undefined })} disabled={isMutating} className="bg-emerald-600 text-white hover:bg-emerald-500"><CheckCircle2 className="mr-1.5 h-4 w-4" />Aprobar y activar</Button>
        <Button size="sm" variant="outline" onClick={reject} disabled={isMutating} className="border-red-500/40 text-red-300 hover:bg-red-500/10 hover:text-red-200"><XCircle className="mr-1.5 h-4 w-4" />Rechazar</Button>
      </div>
    </article>
  );
}

export default function AdminAdvertisers() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"profiles" | "campaigns">("profiles");
  const [statusFilter, setStatusFilter] = useState<"all" | ProfileStatus>("pending");
  const isAdmin = user?.role === "admin";

  const { data: advertisers = [], isLoading: loadingAdvertisers } = trpc.adminAdvertiser.listAdvertisers.useQuery(undefined, { enabled: isAdmin });
  const { data: reviewEvents = [] } = trpc.adminAdvertiser.listAdvertiserReviewEvents.useQuery(undefined, { enabled: isAdmin });
  const { data: pendingCampaigns = [], isLoading: loadingCampaigns } = trpc.adminAdvertiser.listPendingCampaigns.useQuery(undefined, { enabled: isAdmin });

  const counts = useMemo(() => ({
    pending: advertisers.filter((item) => item.status === "pending").length,
    approved: advertisers.filter((item) => item.status === "approved").length,
    actioned: reviewEvents.length,
  }), [advertisers, reviewEvents]);
  const filteredAdvertisers = useMemo(
    () => advertisers.filter((item) => statusFilter === "all" || item.status === statusFilter),
    [advertisers, statusFilter],
  );

  if (!user || !isAdmin) {
    return <div className="rounded-2xl border border-white/10 bg-[#0d1526] p-8 text-center text-white/60">Este centro de aprobación está reservado para Administración.</div>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/50 to-[#0d1526] p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-emerald-300"><Megaphone className="h-5 w-5" /><span className="text-sm font-medium">EVGreen Ads · Administración</span></div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Centro de aprobación de anunciantes</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">Revisa la información comercial, decide sobre perfiles pendientes y conserva el motivo junto con el responsable de cada decisión.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[320px]">
            <div className="rounded-xl bg-amber-500/10 p-3"><p className="text-xl font-bold text-amber-300">{counts.pending}</p><p className="text-xs text-white/55">Pendientes</p></div>
            <div className="rounded-xl bg-emerald-500/10 p-3"><p className="text-xl font-bold text-emerald-300">{counts.approved}</p><p className="text-xs text-white/55">Aprobados</p></div>
            <div className="rounded-xl bg-blue-500/10 p-3"><p className="text-xl font-bold text-blue-300">{counts.actioned}</p><p className="text-xs text-white/55">Decisiones</p></div>
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex rounded-xl bg-white/5 p-1">
          <button type="button" onClick={() => setTab("profiles")} className={`rounded-lg px-3 py-2 text-sm ${tab === "profiles" ? "bg-white/10 text-white" : "text-white/50 hover:text-white"}`}>Perfiles ({advertisers.length})</button>
          <button type="button" onClick={() => setTab("campaigns")} className={`rounded-lg px-3 py-2 text-sm ${tab === "campaigns" ? "bg-white/10 text-white" : "text-white/50 hover:text-white"}`}>Campañas ({pendingCampaigns.length})</button>
        </div>
        {tab === "profiles" && <div className="flex flex-wrap gap-2">
          {(["pending", "approved", "rejected", "suspended", "all"] as const).map((status) => <Button key={status} type="button" variant="outline" size="sm" onClick={() => setStatusFilter(status)} className={statusFilter === status ? "border-emerald-400 bg-emerald-500/10 text-emerald-200" : "border-white/10 text-white/60 hover:bg-white/5 hover:text-white"}>{status === "all" ? "Todos" : STATUS_CONFIG[status].label}</Button>)}
        </div>}
      </div>

      {tab === "profiles" ? (
        <section className="space-y-3">
          {loadingAdvertisers ? <div className="rounded-2xl border border-white/10 bg-[#0d1526] p-10 text-center text-white/55">Cargando perfiles…</div> : filteredAdvertisers.length === 0 ? <div className="rounded-2xl border border-white/10 bg-[#0d1526] p-10 text-center text-white/55">No hay perfiles en este estado.</div> : filteredAdvertisers.map((advertiser) => <AdvertiserReviewCard key={advertiser.id} advertiser={advertiser} reviewEvents={reviewEvents} />)}
        </section>
      ) : (
        <section className="space-y-3">
          {loadingCampaigns ? <div className="rounded-2xl border border-white/10 bg-[#0d1526] p-10 text-center text-white/55">Cargando campañas…</div> : pendingCampaigns.length === 0 ? <div className="rounded-2xl border border-white/10 bg-[#0d1526] p-10 text-center text-white/55">No hay campañas pendientes de revisión.</div> : pendingCampaigns.map((campaign) => <CampaignReviewCard key={campaign.id} campaign={campaign} />)}
        </section>
      )}
    </div>
  );
}
