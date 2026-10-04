import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  Landmark,
  RefreshCw,
  ShieldCheck,
  WalletCards,
} from "lucide-react";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

/**
 * Vista de control financiero dentro de Reportes. No es una pantalla de
 * operación: sólo muestra los asientos aprobados que ya existen en billetera.
 */
export function FinancialReconciliationReport() {
  const reconciliationQuery = trpc.reports.financialReconciliations.useQuery(
    { limit: 100 },
    { refetchInterval: 60_000 },
  );
  const items = reconciliationQuery.data?.items ?? [];

  const totals = useMemo(() => items.reduce((summary, item) => ({
    cases: summary.cases + 1,
    adjustments: summary.adjustments + item.adjustmentCount,
    refundedToUsers: summary.refundedToUsers + item.refundedToUser,
    reversedFromInvestors: summary.reversedFromInvestors + item.reversedFromInvestor,
    netLedgerImpact: summary.netLedgerImpact + item.netLedgerImpact,
  }), {
    cases: 0,
    adjustments: 0,
    refundedToUsers: 0,
    reversedFromInvestors: 0,
    netLedgerImpact: 0,
  }), [items]);

  if (reconciliationQuery.isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-28" />)}
      </div>
    );
  }

  return (
    <section className="space-y-4" aria-labelledby="financial-reconciliations-title">
      <Card className="p-4 sm:p-6 border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-background to-background">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="financial-reconciliations-title" className="text-lg font-semibold">Conciliaciones y excepciones</h2>
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300">Libro auditable</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground max-w-3xl">
                Registro de asientos financieros aprobados por una corrección operativa. No altera ingresos ni permite movimientos desde esta vista.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => reconciliationQuery.refetch()}
            disabled={reconciliationQuery.isFetching}
            className="self-start"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${reconciliationQuery.isFetching ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><ShieldCheck className="h-5 w-5" /></div>
            <div className="min-w-0"><p className="text-xl font-bold">{totals.cases}</p><p className="text-xs text-muted-foreground">Casos conciliados</p></div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600"><WalletCards className="h-5 w-5" /></div>
            <div className="min-w-0"><p className="text-sm sm:text-lg font-bold truncate">{formatCurrency(totals.refundedToUsers)}</p><p className="text-xs text-muted-foreground">Reintegrado a usuarios</p></div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600"><Landmark className="h-5 w-5" /></div>
            <div className="min-w-0"><p className="text-sm sm:text-lg font-bold truncate">{formatCurrency(totals.reversedFromInvestors)}</p><p className="text-xs text-muted-foreground">Reversado a inversionistas</p></div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600"><CircleDollarSign className="h-5 w-5" /></div>
            <div className="min-w-0"><p className="text-sm sm:text-lg font-bold truncate">{formatCurrency(totals.netLedgerImpact)}</p><p className="text-xs text-muted-foreground">Neto en libro</p></div>
          </div>
        </Card>
      </div>

      <Card className="p-4 border-blue-500/20 bg-blue-500/5">
        <p className="flex gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
          Las retransmisiones OCPP nuevas se bloquean antes de crear una segunda sesión o débito; si el cargador las repite, soporte recibe una alerta técnica deduplicada para revisar conectividad o firmware.
        </p>
      </Card>

      {reconciliationQuery.error ? (
        <Card className="p-6 text-sm text-destructive">
          No fue posible cargar el libro de conciliaciones: {reconciliationQuery.error.message}
        </Card>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center">
          <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-emerald-500" />
          <h3 className="font-semibold">Sin conciliaciones financieras registradas</h3>
          <p className="mt-1 text-sm text-muted-foreground">Cuando se apruebe un ajuste respaldado por asientos de billetera, aparecerá aquí con su referencia e idempotencia.</p>
        </Card>
      ) : (
        <>
          <Card className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="p-4 font-medium">Caso</th>
                  <th className="p-4 font-medium">Cliente / estación</th>
                  <th className="p-4 font-medium">Reintegro</th>
                  <th className="p-4 font-medium">Reverso</th>
                  <th className="p-4 font-medium">Asientos</th>
                  <th className="p-4 font-medium">Cierre</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.transactionId} className="border-b last:border-0 align-top">
                    <td className="p-4">
                      <p className="font-mono font-semibold">#{item.transactionId}</p>
                      <Badge variant="secondary" className="mt-1">{item.transaction?.status || "Ajuste histórico"}</Badge>
                    </td>
                    <td className="p-4">
                      <p className="font-medium">{item.user?.name || "Usuario no disponible"}</p>
                      <p className="text-xs text-muted-foreground">{item.station?.name || "Estación no disponible"}</p>
                    </td>
                    <td className="p-4 font-medium text-sky-600">{formatCurrency(item.refundedToUser)}</td>
                    <td className="p-4 font-medium text-amber-600">{formatCurrency(item.reversedFromInvestor)}</td>
                    <td className="p-4">
                      <p className="font-medium">{item.adjustmentCount} ajuste{item.adjustmentCount === 1 ? "" : "s"}</p>
                      <p className="text-xs text-muted-foreground">Libro: {item.ledgerEntryCount} asientos · Neto: {formatCurrency(item.netLedgerImpact)}</p>
                    </td>
                    <td className="p-4 text-xs text-muted-foreground">{formatDate(item.completedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <div className="space-y-3 lg:hidden">
            {items.map((item) => (
              <Card key={item.transactionId} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono font-semibold">Caso #{item.transactionId}</p>
                    <p className="mt-1 text-sm font-medium">{item.user?.name || "Usuario no disponible"}</p>
                    <p className="text-xs text-muted-foreground">{item.station?.name || "Estación no disponible"}</p>
                  </div>
                  <Badge variant="secondary">{item.transaction?.status || "Histórico"}</Badge>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-3 text-sm">
                  <div><p className="text-xs text-muted-foreground">Reintegro</p><p className="font-semibold text-sky-600">{formatCurrency(item.refundedToUser)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Reverso</p><p className="font-semibold text-amber-600">{formatCurrency(item.reversedFromInvestor)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Asientos</p><p className="font-semibold">{item.adjustmentCount}</p></div>
                  <div><p className="text-xs text-muted-foreground">Cierre</p><p className="font-medium text-xs">{formatDate(item.completedAt)}</p></div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
