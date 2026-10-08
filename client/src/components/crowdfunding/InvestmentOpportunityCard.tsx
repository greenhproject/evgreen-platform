import {
  ArrowRight,
  BatteryCharging,
  Camera,
  CheckCircle2,
  DollarSign,
  Image as ImageIcon,
  MapPin,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  Timer,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export type InvestmentOpportunityCardProps = {
  variant: "crowdfunding" | "space";
  title: string;
  city?: string | null;
  region?: string | null;
  typeLabel?: string | null;
  imageUrl?: string | null;
  imageCount?: number;
  status?: string | null;
  targetDateLabel?: string | null;
  targetAmount?: number | null;
  raisedAmount?: number | null;
  showFunding?: boolean;
  investmentAmount?: number | null;
  minimumInvestment?: number | null;
  investorCount?: number | null;
  powerKw?: number | null;
  chargerCount?: number | null;
  chargerPowerKw?: number | null;
  connectorType?: string | null;
  hasSolar?: boolean;
  roiPercent?: number | string | null;
  paybackMonths?: number | null;
  aiScore?: number | null;
  viewCount?: number | null;
  onSelect?: () => void;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
};

const STATUS_COPY: Record<string, { label: string; className: string; icon: typeof Timer }> = {
  OPEN: { label: "Abierto", className: "border-amber-300/30 bg-amber-400/15 text-amber-200", icon: Timer },
  ACTIVE: { label: "Abierto", className: "border-amber-300/30 bg-amber-400/15 text-amber-200", icon: Timer },
  IN_PROGRESS: { label: "En ejecución", className: "border-orange-300/30 bg-orange-400/15 text-orange-200", icon: Zap },
  FUNDED: { label: "Financiado", className: "border-emerald-300/30 bg-emerald-400/15 text-emerald-200", icon: CheckCircle2 },
  COMPLETED: { label: "Operando", className: "border-emerald-300/30 bg-emerald-400/15 text-emerald-200", icon: CheckCircle2 },
  DRAFT: { label: "Próximamente", className: "border-slate-300/20 bg-slate-400/15 text-slate-300", icon: Timer },
  PROXIMAMENTE: { label: "Próximamente", className: "border-slate-300/20 bg-slate-400/15 text-slate-300", icon: Timer },
  published: { label: "Espacio publicado", className: "border-emerald-300/30 bg-emerald-400/15 text-emerald-200", icon: CheckCircle2 },
  funded: { label: "Financiado", className: "border-emerald-300/30 bg-emerald-400/15 text-emerald-200", icon: CheckCircle2 },
  in_construction: { label: "En construcción", className: "border-orange-300/30 bg-orange-400/15 text-orange-200", icon: Zap },
  operational: { label: "Operando", className: "border-emerald-300/30 bg-emerald-400/15 text-emerald-200", icon: CheckCircle2 },
};

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatCOP(value: number | null | undefined, compact = false): string {
  const amount = toFiniteNumber(value);
  if (amount === null) return "—";
  if (compact && amount >= 1_000_000_000) return `COP ${(amount / 1_000_000_000).toFixed(1)} B`;
  if (compact && amount >= 1_000_000) return `COP ${(amount / 1_000_000).toFixed(0)} M`;
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPercent(value: number | string | null | undefined): string | null {
  const parsed = toFiniteNumber(value);
  if (parsed === null || parsed <= 0) return null;
  return `${parsed % 1 === 0 ? parsed.toFixed(0) : parsed.toFixed(1)}%`;
}

export function InvestmentOpportunityCard({
  variant,
  title,
  city,
  region,
  typeLabel,
  imageUrl,
  imageCount = 0,
  status,
  targetDateLabel,
  targetAmount,
  raisedAmount = 0,
  showFunding = variant === "crowdfunding",
  investmentAmount,
  minimumInvestment,
  investorCount,
  powerKw,
  chargerCount,
  chargerPowerKw,
  connectorType = "CCS2",
  hasSolar = false,
  roiPercent,
  paybackMonths,
  aiScore,
  viewCount,
  onSelect,
  actionLabel,
  actionHref,
  onAction,
}: InvestmentOpportunityCardProps) {
  const isCrowdfunding = variant === "crowdfunding";
  const palette = isCrowdfunding
    ? {
        border: "border-amber-300/25 hover:border-amber-300/60",
        panel: "from-[#2c160d] via-[#1b1210] to-slate-950",
        accent: "text-amber-300",
        progress: "from-amber-400 to-orange-500",
        soft: "bg-amber-400/10",
        button: "from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400",
      }
    : {
        border: "border-emerald-300/20 hover:border-emerald-300/55",
        panel: "from-[#102b26] via-[#111e21] to-slate-950",
        accent: "text-emerald-300",
        progress: "from-emerald-400 to-green-500",
        soft: "bg-emerald-400/10",
        button: "from-emerald-400 to-teal-500 hover:from-emerald-300 hover:to-teal-400",
      };

  const normalizedStatus = status || (isCrowdfunding ? "OPEN" : "published");
  const statusCopy = STATUS_COPY[normalizedStatus] || {
    label: normalizedStatus.replaceAll("_", " "),
    className: "border-white/15 bg-white/10 text-white/70",
    icon: Sparkles,
  };
  const StatusIcon = statusCopy.icon;
  const numericTarget = toFiniteNumber(targetAmount);
  const numericRaised = toFiniteNumber(raisedAmount) ?? 0;
  const fundingPct = numericTarget && numericTarget > 0
    ? Math.min(100, Math.max(0, Math.round((numericRaised / numericTarget) * 100)))
    : 0;
  const formattedRoi = formatPercent(roiPercent);
  const location = [city, region].filter(Boolean).join(" · ");
  const displayType = typeLabel || (isCrowdfunding ? "Estación de carga rápida" : "Espacio publicado");
  const hasImage = Boolean(imageUrl);
  const canShowAction = Boolean(actionLabel && (actionHref || onAction));
  const fallbackInvestment = toFiniteNumber(investmentAmount);

  const handleSelectKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (!onSelect || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    onSelect();
  };

  return (
    <article
      className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-gradient-to-br ${palette.panel} shadow-[0_18px_50px_rgba(0,0,0,0.22)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(0,0,0,0.35)] ${palette.border}`}
      onClick={onSelect}
      onKeyDown={handleSelectKeyDown}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
    >
      <div className="relative h-44 overflow-hidden border-b border-white/10 bg-slate-900/80">
        {hasImage ? (
          <img
            src={imageUrl || undefined}
            alt={`Imagen de ${title}`}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className={`flex h-full flex-col items-center justify-center bg-[radial-gradient(circle_at_30%_20%,rgba(16,185,129,0.24),transparent_45%),linear-gradient(135deg,#102a27,#111827)] ${isCrowdfunding ? "bg-[radial-gradient(circle_at_70%_30%,rgba(245,158,11,0.22),transparent_45%),linear-gradient(135deg,#29170e,#111827)]" : ""}`}>
            <div className={`mb-2 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 ${palette.soft}`}>
              <ImageIcon className={`h-6 w-6 ${palette.accent}`} />
            </div>
            <span className="text-xs font-medium text-white/55">Imagen del sitio próximamente</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
        <div className="absolute left-4 right-4 top-4 flex items-start justify-between gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold backdrop-blur-md ${statusCopy.className}`}>
            <StatusIcon className="h-3.5 w-3.5" />
            {statusCopy.label}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/35 px-2.5 py-1 text-[11px] font-semibold text-white/85 backdrop-blur-md">
            <BatteryCharging className={`h-3.5 w-3.5 ${palette.accent}`} />
            {connectorType || "CCS2"}
          </span>
        </div>
        <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className={`mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] ${palette.accent}`}>
              {isCrowdfunding ? <Star className="h-3.5 w-3.5 fill-current" /> : <MapPin className="h-3.5 w-3.5" />}
              {displayType}
            </p>
            <h3 className="truncate text-xl font-bold text-white">{title}</h3>
            {location && <p className="truncate text-sm text-white/65">{location}</p>}
          </div>
          {imageCount > 0 && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[11px] text-white/80 backdrop-blur-md">
              <Camera className="h-3.5 w-3.5" />
              {imageCount} {imageCount === 1 ? "foto" : "fotos"}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {powerKw !== null && powerKw !== undefined && (
            <div className="rounded-xl border border-white/8 bg-black/20 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-white/45">Potencia</p>
              <p className="mt-0.5 text-sm font-bold text-white">{powerKw} kW</p>
            </div>
          )}
          {chargerCount !== null && chargerCount !== undefined && (
            <div className="rounded-xl border border-white/8 bg-black/20 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-white/45">Cargadores</p>
              <p className="mt-0.5 text-sm font-bold text-white">{chargerCount}</p>
            </div>
          )}
          {chargerPowerKw !== null && chargerPowerKw !== undefined && (
            <div className="rounded-xl border border-white/8 bg-black/20 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-white/45">Por cargador</p>
              <p className="mt-0.5 text-sm font-bold text-white">{chargerPowerKw} kW</p>
            </div>
          )}
          {hasSolar && (
            <div className="rounded-xl border border-emerald-300/15 bg-emerald-300/10 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-emerald-200/65">Energía</p>
              <p className="mt-0.5 flex items-center gap-1 text-sm font-bold text-emerald-200"><Sun className="h-3.5 w-3.5" /> Solar</p>
            </div>
          )}
          {!hasSolar && connectorType && !chargerPowerKw && (
            <div className="rounded-xl border border-white/8 bg-black/20 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-white/45">Conector</p>
              <p className="mt-0.5 text-sm font-bold text-white">{connectorType}</p>
            </div>
          )}
        </div>

        {showFunding && numericTarget !== null && numericTarget > 0 ? (
          <div className="mt-5 rounded-xl border border-white/8 bg-black/20 p-3.5">
            <div className="mb-2 flex items-center justify-between gap-3 text-xs">
              <span className="font-medium text-white/60">Progreso de financiación</span>
              <span className={`font-bold ${palette.accent}`}>{fundingPct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div className={`h-full rounded-full bg-gradient-to-r ${palette.progress} transition-all duration-500`} style={{ width: `${fundingPct}%` }} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-white/40">Recaudado</p>
                <p className="mt-0.5 text-base font-bold text-white">{formatCOP(numericRaised, true)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wide text-white/40">Meta</p>
                <p className="mt-0.5 text-base font-bold text-white">{formatCOP(numericTarget, true)}</p>
              </div>
            </div>
          </div>
        ) : fallbackInvestment !== null ? (
          <div className="mt-5 rounded-xl border border-white/8 bg-black/20 px-3.5 py-3">
            <p className="text-[10px] uppercase tracking-wide text-white/40">Inversión estimada</p>
            <p className={`mt-0.5 text-lg font-bold ${palette.accent}`}>{formatCOP(fallbackInvestment, true)}</p>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-white/55">
          {minimumInvestment !== null && minimumInvestment !== undefined && (
            <span className="flex items-center gap-1.5"><DollarSign className={`h-3.5 w-3.5 ${palette.accent}`} />Desde {formatCOP(minimumInvestment, true)}</span>
          )}
          {investorCount !== null && investorCount !== undefined && (
            <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-white/45" />{investorCount} inversionistas</span>
          )}
          {aiScore !== null && aiScore !== undefined && (
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />Viabilidad {aiScore}/100</span>
          )}
          {viewCount !== null && viewCount !== undefined && viewCount > 0 && (
            <span className="text-white/40">{viewCount} visitas</span>
          )}
        </div>

        {(formattedRoi || paybackMonths || targetDateLabel) && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/8 pt-3 text-xs">
            {formattedRoi && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2.5 py-1 font-semibold text-emerald-200"><TrendingUp className="h-3.5 w-3.5" />ROI estimado {formattedRoi}</span>}
            {paybackMonths && paybackMonths > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-white/8 px-2.5 py-1 text-white/65"><Timer className="h-3.5 w-3.5" />Recuperación {paybackMonths} meses</span>}
            {targetDateLabel && targetDateLabel !== "TBD" && <span className="ml-auto text-white/40">Objetivo: {targetDateLabel}</span>}
          </div>
        )}

        {canShowAction && (
          <div className="mt-5 flex gap-2">
            {onSelect && (
              <Button
                type="button"
                variant="outline"
                className="flex-1 border-white/15 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white"
                onClick={(event) => { event.stopPropagation(); onSelect(); }}
              >
                Ver detalles
              </Button>
            )}
            {actionHref ? (
              <a
                href={actionHref}
                target={actionHref.startsWith("http") ? "_blank" : undefined}
                rel={actionHref.startsWith("http") ? "noopener noreferrer" : undefined}
                className={`inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-gradient-to-r px-4 py-2 text-sm font-bold text-slate-950 transition-all ${palette.button}`}
                onClick={(event) => event.stopPropagation()}
              >
                {actionLabel}
                <ArrowRight className="h-4 w-4" />
              </a>
            ) : (
              <Button
                type="button"
                className={`flex-1 bg-gradient-to-r text-slate-950 ${palette.button}`}
                onClick={(event) => { event.stopPropagation(); onAction?.(); }}
              >
                {actionLabel}
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
