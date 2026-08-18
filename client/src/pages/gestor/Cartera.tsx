/**
 * Portal Comercial — Cartera unificada.
 * Une oportunidades (espacios) y activos operativos (estaciones) para eliminar
 * duplicidad de navegación y dar contexto de negocio al gestor.
 */
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  ArrowRight,
  Building2,
  CircleDollarSign,
  Copy,
  FileText,
  Link2,
  Mail,
  MapPin,
  MessageCircle,
  Plus,
  RefreshCw,
  TrendingUp,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";

const currency = (value: number) => new Intl.NumberFormat("es-CO", {
  style: "currency", currency: "COP", maximumFractionDigits: 0,
}).format(value);

const SPACE_STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendiente", className: "bg-amber-500/15 text-amber-300 border-amber-500/25" },
  under_review: { label: "En revisión", className: "bg-blue-500/15 text-blue-300 border-blue-500/25" },
  approved: { label: "Viable", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25" },
  letter_sent: { label: "Carta enviada", className: "bg-violet-500/15 text-violet-300 border-violet-500/25" },
  letter_accepted: { label: "Contratado", className: "bg-purple-500/15 text-purple-300 border-purple-500/25" },
  published: { label: "Publicado", className: "bg-cyan-500/15 text-cyan-300 border-cyan-500/25" },
  funded: { label: "Fondeado", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25" },
  in_construction: { label: "En construcción", className: "bg-orange-500/15 text-orange-300 border-orange-500/25" },
  operational: { label: "Operativo", className: "bg-green-500/15 text-green-300 border-green-500/25" },
  rejected: { label: "No aprobado", className: "bg-red-500/15 text-red-300 border-red-500/25" },
};

type Filter = "all" | "opportunities" | "operational";

export default function GestorCartera() {
  const [filter, setFilter] = useState<Filter>("all");
  const { data, isLoading, refetch, isFetching } = trpc.gestor.getCartera.useQuery();

  const spaces = data?.spaces ?? [];
  const stations = data?.stations ?? [];
  const visibleSpaces = useMemo(() => filter === "operational" ? [] : spaces, [filter, spaces]);
  const visibleStations = useMemo(() => filter === "opportunities" ? [] : stations, [filter, stations]);

  return (
    <div className="space-y-5 pb-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-emerald-400 text-xs font-semibold uppercase tracking-[0.16em]">Portal comercial</p>
          <h1 className="text-2xl font-bold tracking-tight text-white">Mi cartera</h1>
          <p className="mt-1 text-sm text-slate-400">Oportunidades y activos operativos en una sola vista.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            <RefreshCw className={`mr-1.5 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <Link href="/gestor/espacios">
            <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-500">
              <Plus className="mr-1.5 h-4 w-4" />
              Postular
            </Button>
          </Link>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard icon={MapPin} label="Oportunidades" value={String(spaces.length)} accent="text-sky-300" background="bg-sky-500/10" />
        <MetricCard icon={Zap} label="Estaciones activas" value={String(data?.summary.activeStations ?? 0)} accent="text-emerald-300" background="bg-emerald-500/10" />
        <MetricCard icon={TrendingUp} label="Facturación del mes" value={currency(data?.summary.monthRevenue ?? 0)} accent="text-violet-300" background="bg-violet-500/10" compact />
        <MetricCard icon={CircleDollarSign} label="Comisión devengada" value={currency(data?.summary.monthCommissionAccrued ?? 0)} accent="text-amber-300" background="bg-amber-500/10" compact />
      </section>

      <section className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>Toda la cartera</FilterButton>
        <FilterButton active={filter === "opportunities"} onClick={() => setFilter("opportunities")}>Oportunidades</FilterButton>
        <FilterButton active={filter === "operational"} onClick={() => setFilter("operational")}>Operativas</FilterButton>
      </section>

      {isLoading ? (
        <div className="flex min-h-56 items-center justify-center">
          <RefreshCw className="h-6 w-6 animate-spin text-emerald-400" />
        </div>
      ) : (
        <div className="space-y-5">
          {visibleStations.length > 0 && (
            <section className="space-y-3">
              <SectionTitle icon={Zap} title="Activos operativos" subtitle="Métricas de transacciones reales del mes en curso." />
              <div className="grid gap-3 xl:grid-cols-2">
                {visibleStations.map((station) => (
                  <Card key={station.id} className="overflow-hidden border-emerald-500/20 bg-slate-900/70">
                    <CardContent className="p-0">
                      <div className="flex gap-3 p-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
                          <Zap className="h-5 w-5 text-emerald-300" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-white">{station.name}</p>
                              <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400"><MapPin className="h-3 w-3" />{station.city}{station.department ? `, ${station.department}` : ""}</p>
                            </div>
                            <Badge className={station.isOnline ? "shrink-0 border-emerald-500/25 bg-emerald-500/15 text-emerald-300" : "shrink-0 border-slate-600 bg-slate-700 text-slate-300"}>
                              {station.isOnline ? <Wifi className="mr-1 h-3 w-3" /> : <WifiOff className="mr-1 h-3 w-3" />}
                              {station.isOnline ? "En línea" : "Sin conexión"}
                            </Badge>
                          </div>
                          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-800 pt-3">
                            <SmallValue label="Sesiones" value={String(station.month.totalSessions)} />
                            <SmallValue label="Facturación" value={currency(station.month.grossRevenue)} />
                            <SmallValue label="Devengado" value={currency(station.month.commissionAccrued)} accent />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950/40 px-4 py-2.5 text-xs">
                        <span className="text-slate-400">Comisión: <strong className="text-slate-200">{Number(station.gestorCommissionPercent).toFixed(2)}% del margen distribuible</strong></span>
                        <Link href="/gestor/liquidacion" className="inline-flex items-center gap-1 font-medium text-emerald-300 hover:text-emerald-200">Auditar <ArrowRight className="h-3.5 w-3.5" /></Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {visibleSpaces.length > 0 && (
            <section className="space-y-3">
              <SectionTitle icon={Building2} title="Oportunidades en gestión" subtitle="Espacios vinculados a tu cartera comercial." />
              <div className="grid gap-3 xl:grid-cols-2">
                {visibleSpaces.map((space) => {
                  const status = SPACE_STATUS[space.status ?? "pending"] ?? SPACE_STATUS.pending;
                  return (
                    <Card key={space.id} className="border-slate-700 bg-slate-900/65">
                      <CardContent className="flex gap-3 p-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-500/10"><MapPin className="h-5 w-5 text-sky-300" /></div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-white">{space.name}</p>
                              <p className="mt-0.5 truncate text-xs text-slate-400">{space.address} · {space.city}{space.department ? `, ${space.department}` : ""}</p>
                            </div>
                            <Badge className={`shrink-0 border ${status.className}`}>{status.label}</Badge>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                            <span className="font-mono text-slate-500">{space.code}</span>
                            {space.aiScore !== null && <span>Viabilidad IA: <strong className="text-sky-300">{space.aiScore}/100</strong></span>}
                            <span>Comisión: <strong className="text-emerald-300">{Number(space.gestorCommissionPercent).toFixed(2)}%</strong></span>
                          </div>
                          {space.status === "letter_sent" && <LetterFollowUpActions spaceId={space.id} submitterName={space.submitterName ?? ""} spaceName={space.name} onChanged={refetch} />}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          )}

          {visibleStations.length === 0 && visibleSpaces.length === 0 && (
            <Card className="border-dashed border-slate-700 bg-slate-900/50">
              <CardContent className="flex flex-col items-center p-10 text-center">
                <Building2 className="mb-3 h-10 w-10 text-slate-600" />
                <p className="font-medium text-white">No hay elementos en esta vista</p>
                <p className="mt-1 max-w-md text-sm text-slate-400">Cuando postules un espacio o se vincule una estación a tu usuario comercial, aparecerá aquí con su contexto operativo y financiero.</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Card className="border-sky-500/15 bg-sky-500/[0.04]">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-sky-200">¿Necesitas una propuesta para una oportunidad?</p>
            <p className="mt-0.5 text-sm text-slate-400">Construye, envía y da seguimiento a cotizaciones desde tu espacio comercial.</p>
          </div>
          <Link href="/gestor/cotizaciones"><Button variant="outline" className="border-sky-500/30 text-sky-200 hover:bg-sky-500/10"><FileText className="mr-2 h-4 w-4" />Abrir cotizaciones</Button></Link>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, accent, background, compact }: { icon: typeof Zap; label: string; value: string; accent: string; background: string; compact?: boolean }) {
  return <Card className="border-slate-800 bg-slate-900/65"><CardContent className="p-3 sm:p-4"><div className="flex items-start gap-2.5"><div className={`rounded-lg p-2 ${background}`}><Icon className={`h-4 w-4 ${accent}`} /></div><div className="min-w-0"><p className={`truncate font-bold text-white ${compact ? "text-base sm:text-lg" : "text-xl"}`}>{value}</p><p className="mt-0.5 text-[11px] leading-tight text-slate-400">{label}</p></div></div></CardContent></Card>;
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${active ? "border-emerald-500/35 bg-emerald-500/15 text-emerald-200" : "border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200"}`}>{children}</button>;
}

function SectionTitle({ icon: Icon, title, subtitle }: { icon: typeof Zap; title: string; subtitle: string }) {
  return <div><div className="flex items-center gap-2"><Icon className="h-4 w-4 text-emerald-300" /><h2 className="font-semibold text-white">{title}</h2></div><p className="mt-0.5 text-xs text-slate-500">{subtitle}</p></div>;
}

function SmallValue({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <div className="min-w-0"><p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p><p className={`mt-0.5 truncate text-xs font-semibold ${accent ? "text-emerald-300" : "text-slate-200"}`}>{value}</p></div>;
}

function LetterFollowUpActions({ spaceId, submitterName, spaceName, onChanged }: { spaceId: number; submitterName: string; spaceName: string; onChanged: () => void }) {
  const [link, setLink] = useState<string | null>(null);
  const getLinkMutation = trpc.gestor.getCartaSeguimiento.useMutation();
  const resendMutation = trpc.gestor.reenviarCartaSeguimiento.useMutation();
  const rotateMutation = trpc.gestor.rotarCartaSeguimiento.useMutation();

  const getLink = async () => {
    try {
      const result = await getLinkMutation.mutateAsync({ spaceId });
      setLink(result.acceptUrl);
      toast.success("Enlace de firma listo para seguimiento.");
    } catch (error: any) { toast.error(error.message || "No fue posible obtener el enlace"); }
  };
  const copyLink = async () => {
    if (!link) return;
    try { await navigator.clipboard.writeText(link); toast.success("Enlace de firma copiado."); }
    catch { toast.error("No se pudo copiar el enlace automáticamente."); }
  };
  const openWhatsApp = () => {
    if (!link) return;
    const text = `Hola${submitterName ? ` ${submitterName}` : ""}, te compartimos la Carta de Intención para ${spaceName}. Puedes revisarla y firmarla de forma segura aquí: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };
  const resend = async () => {
    try {
      const result = await resendMutation.mutateAsync({ spaceId });
      setLink(result.acceptUrl);
      onChanged();
      toast.success("Carta reenviada por correo. El enlace anterior fue revocado.");
    } catch (error: any) { toast.error(error.message || "No fue posible reenviar la carta"); }
  };
  const rotate = async () => {
    try {
      const result = await rotateMutation.mutateAsync({ spaceId });
      setLink(result.acceptUrl);
      onChanged();
      toast.success("Enlace rotado. El vínculo anterior ya no es válido.");
    } catch (error: any) { toast.error(error.message || "No fue posible rotar el enlace"); }
  };

  return <div className="mt-4 border-t border-violet-500/20 pt-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-medium text-violet-200">Seguimiento de carta</p>{!link && <Button size="sm" variant="outline" onClick={getLink} disabled={getLinkMutation.isPending} className="h-8 border-violet-500/35 text-violet-200 hover:bg-violet-500/10"><Link2 className="mr-1 h-3.5 w-3.5" />Obtener enlace</Button>}</div>
    {link && <div className="mt-2 space-y-2"><p className="break-all rounded-md bg-slate-950/60 px-2 py-1.5 text-[11px] text-violet-200">{link}</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><Button size="sm" variant="outline" onClick={copyLink} className="h-8 border-slate-700 text-slate-200 hover:bg-slate-800"><Copy className="mr-1 h-3.5 w-3.5" />Copiar</Button><Button size="sm" onClick={openWhatsApp} className="h-8 bg-emerald-600 text-white hover:bg-emerald-500"><MessageCircle className="mr-1 h-3.5 w-3.5" />WhatsApp</Button><Button size="sm" variant="outline" onClick={resend} disabled={resendMutation.isPending} className="h-8 border-sky-500/35 text-sky-200 hover:bg-sky-500/10"><Mail className="mr-1 h-3.5 w-3.5" />Reenviar</Button><Button size="sm" variant="outline" onClick={rotate} disabled={rotateMutation.isPending} className="h-8 border-amber-500/35 text-amber-200 hover:bg-amber-500/10"><RefreshCw className={`mr-1 h-3.5 w-3.5 ${rotateMutation.isPending ? "animate-spin" : ""}`} />Rotar</Button></div></div>}
  </div>;
}
