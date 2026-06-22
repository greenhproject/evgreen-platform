import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FileText, Download, BarChart2, Zap, TrendingUp, Clock } from "lucide-react";
import { toast } from "sonner";

function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
}

export default function OrgReports() {
  const [period, setPeriod] = useState<"7d" | "30d" | "90d" | "all">("30d");
  const [format, setFormat] = useState<"pdf" | "csv">("pdf");
  const [isExporting, setIsExporting] = useState(false);

  const { data: stats } = (trpc.organizations as any).getMyOrgStats.useQuery(
    { period },
    { staleTime: 2 * 60 * 1000 }
  );

  const { data: transactions } = (trpc.organizations as any).getOrgTransactions.useQuery(
    { period, page: 1, limit: 1000 },
    { staleTime: 2 * 60 * 1000 }
  );

  const exportReport = async () => {
    setIsExporting(true);
    try {
      const txs: any[] = transactions?.transactions || [];

      if (format === "csv") {
        // Generate CSV
        const headers = ["ID", "Estación", "Usuario", "Email", "Inicio", "Fin", "kWh", "Total COP", "Estado"];
        const rows = txs.map((t: any) => [
          t.id,
          t.station_name || `#${t.station_id}`,
          t.user_name || "Anónimo",
          t.user_email || "",
          t.start_time ? new Date(t.start_time).toLocaleString("es-CO") : "",
          t.end_time ? new Date(t.end_time).toLocaleString("es-CO") : "",
          parseFloat(t.energy_kwh || 0).toFixed(2),
          parseFloat(t.total_cost || 0).toFixed(0),
          t.status,
        ]);
        const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `reporte-evgreen-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Reporte CSV descargado");
      } else {
        // Generate simple HTML → print as PDF
        const periodLabel = { "7d": "7 días", "30d": "30 días", "90d": "90 días", "all": "Todo el tiempo" }[period];
        const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Reporte EVGreen</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 32px; color: #111; }
    h1 { color: #16a34a; font-size: 24px; margin-bottom: 4px; }
    .subtitle { color: #666; font-size: 13px; margin-bottom: 24px; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
    .kpi { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px; }
    .kpi-label { font-size: 11px; color: #666; }
    .kpi-value { font-size: 20px; font-weight: bold; color: #16a34a; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #f0fdf4; padding: 8px; text-align: left; border-bottom: 2px solid #bbf7d0; }
    td { padding: 7px 8px; border-bottom: 1px solid #e5e7eb; }
    tr:nth-child(even) { background: #f9fafb; }
    .footer { margin-top: 24px; font-size: 11px; color: #999; text-align: center; }
  </style>
</head>
<body>
  <h1>⚡ Reporte EVGreen</h1>
  <p class="subtitle">Período: ${periodLabel} · Generado: ${new Date().toLocaleString("es-CO")}</p>
  <div class="kpis">
    <div class="kpi"><div class="kpi-label">Sesiones completadas</div><div class="kpi-value">${stats?.completedSessions ?? 0}</div></div>
    <div class="kpi"><div class="kpi-label">kWh entregados</div><div class="kpi-value">${(stats?.totalKwh ?? 0).toFixed(1)}</div></div>
    <div class="kpi"><div class="kpi-label">Ingresos totales</div><div class="kpi-value">${formatCOP(stats?.totalRevenue ?? 0)}</div></div>
    <div class="kpi"><div class="kpi-label">Usuarios únicos</div><div class="kpi-value">${stats?.uniqueUsers ?? 0}</div></div>
  </div>
  <table>
    <thead>
      <tr><th>#</th><th>Estación</th><th>Usuario</th><th>Inicio</th><th>kWh</th><th>Total</th><th>Estado</th></tr>
    </thead>
    <tbody>
      ${txs.slice(0, 500).map((t: any) => `
        <tr>
          <td>${t.id}</td>
          <td>${t.station_name || `#${t.station_id}`}</td>
          <td>${t.user_name || "Anónimo"}</td>
          <td>${t.start_time ? new Date(t.start_time).toLocaleString("es-CO") : "—"}</td>
          <td>${parseFloat(t.energy_kwh || 0).toFixed(2)}</td>
          <td>${formatCOP(parseFloat(t.total_cost || 0))}</td>
          <td>${t.status}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>
  <div class="footer">EVGreen Platform · evgreen.lat · evgreen@greenhproject.com</div>
</body>
</html>`;
        const win = window.open("", "_blank");
        if (win) {
          win.document.write(html);
          win.document.close();
          win.print();
        }
        toast.success("Reporte PDF generado — usa Ctrl+P para guardar");
      }
    } catch (e) {
      toast.error("Error al generar el reporte");
    } finally {
      setIsExporting(false);
    }
  };

  const reportTypes = [
    { icon: <BarChart2 className="h-5 w-5 text-blue-400" />, title: "Reporte de Rendimiento", desc: "Sesiones, kWh, ingresos y disponibilidad por período" },
    { icon: <Zap className="h-5 w-5 text-yellow-400" />, title: "Reporte por Estación", desc: "Desglose detallado de cada estación de tu red" },
    { icon: <TrendingUp className="h-5 w-5 text-green-400" />, title: "Reporte Financiero", desc: "Ingresos, comisiones EVGreen y balance neto" },
    { icon: <Clock className="h-5 w-5 text-purple-400" />, title: "Reporte de Uso por Hora", desc: "Distribución de sesiones por hora del día" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="h-6 w-6 text-green-400" /> Reportes
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Genera y descarga informes de tu red de carga</p>
      </div>

      {/* Export config */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Download className="h-4 w-4 text-green-400" /> Exportar reporte
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Período</Label>
              <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
                <SelectTrigger className="mt-1 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Últimos 7 días</SelectItem>
                  <SelectItem value="30d">Últimos 30 días</SelectItem>
                  <SelectItem value="90d">Últimos 90 días</SelectItem>
                  <SelectItem value="all">Todo el tiempo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Formato</Label>
              <Select value={format} onValueChange={(v: any) => setFormat(v)}>
                <SelectTrigger className="mt-1 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF (imprimir)</SelectItem>
                  <SelectItem value="csv">CSV (Excel)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 py-2">
            {[
              { label: "Sesiones", value: stats?.completedSessions ?? 0 },
              { label: "kWh", value: `${(stats?.totalKwh ?? 0).toFixed(1)}` },
              { label: "Ingresos", value: formatCOP(stats?.totalRevenue ?? 0) },
              { label: "Transacciones", value: transactions?.total ?? 0 },
            ].map((m, i) => (
              <div key={i} className="p-3 rounded-lg bg-muted/30 border border-border/30 text-center">
                <p className="text-xs text-muted-foreground">{m.label}</p>
                <p className="text-lg font-bold mt-1">{m.value}</p>
              </div>
            ))}
          </div>

          <Button
            className="w-full bg-green-600 hover:bg-green-700 h-10"
            onClick={exportReport}
            disabled={isExporting}
          >
            {isExporting ? (
              <span className="flex items-center gap-2">
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generando...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Descargar reporte {format.toUpperCase()}
              </span>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Report types */}
      <div className="grid md:grid-cols-2 gap-4">
        {reportTypes.map((r, i) => (
          <Card key={i} className="bg-card/50 border-border/50 hover:border-green-500/30 transition-colors cursor-pointer"
            onClick={() => toast.info("Próximamente disponible")}>
            <CardContent className="p-4 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-muted/40 flex items-center justify-center shrink-0">
                {r.icon}
              </div>
              <div>
                <p className="text-sm font-semibold">{r.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{r.desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
