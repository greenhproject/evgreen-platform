/**
 * Generador de Reporte Ejecutivo Completo para Organizaciones EVGreen
 * Produce HTML multi-sección listo para impresión/PDF
 */

const formatCOP = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

const formatDate = (d: Date | string | null) => {
  if (!d) return "—";
  return new Date(d).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
};

const formatDateOnly = (d: Date | string | null) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" });
};

const statusLabel = (s: string) => {
  const map: Record<string, string> = {
    COMPLETED: "Completada", IN_PROGRESS: "En progreso", PENDING: "Pendiente",
    FAILED: "Fallida", CANCELLED: "Cancelada",
  };
  return map[s] || s;
};

const statusColor = (s: string) => {
  const map: Record<string, string> = {
    COMPLETED: "#16a34a", IN_PROGRESS: "#2563eb", PENDING: "#d97706",
    FAILED: "#dc2626", CANCELLED: "#6b7280",
  };
  return map[s] || "#6b7280";
};

export interface OrgReportData {
  org: {
    name: string;
    plan: string;
    status: string;
    slug?: string;
  };
  period: string;
  stats: {
    totalSessions: number;
    totalKwh: number;
    totalRevenue: number;
    avgKwhPerSession: number;
    uniqueUsers: number;
  };
  transactions: Array<{
    id: number;
    station_id: number;
    station_name?: string;
    user_name?: string;
    user_email?: string;
    start_time?: string | Date;
    end_time?: string | Date;
    energy_kwh?: string | number;
    total_cost?: string | number;
    status?: string;
    connector_id?: number;
  }>;
  stations: Array<{
    id: number;
    name: string;
    address?: string;
    city?: string;
    isActive?: boolean;
    evses?: any[];
  }>;
}

export function generateOrgReportHtml(data: OrgReportData): string {
  const { org, period, stats, transactions, stations } = data;
  const periodLabel: Record<string, string> = {
    "7d": "Últimos 7 días", "30d": "Últimos 30 días", "90d": "Últimos 90 días", "all": "Todo el tiempo",
  };

  // ── Calcular datos por estación ──────────────────────────────────────────────
  const stationMap: Record<string, { name: string; sessions: number; kwh: number; revenue: number; completed: number; cancelled: number }> = {};
  transactions.forEach((t) => {
    const key = t.station_name || `Estación #${t.station_id}`;
    if (!stationMap[key]) stationMap[key] = { name: key, sessions: 0, kwh: 0, revenue: 0, completed: 0, cancelled: 0 };
    stationMap[key].sessions++;
    stationMap[key].kwh += parseFloat(String(t.energy_kwh || 0));
    stationMap[key].revenue += parseFloat(String(t.total_cost || 0));
    if (t.status === "COMPLETED") stationMap[key].completed++;
    if (t.status === "CANCELLED") stationMap[key].cancelled++;
  });
  const stationStats = Object.values(stationMap).sort((a, b) => b.sessions - a.sessions);

  // ── Calcular datos por hora ──────────────────────────────────────────────────
  const hourMap: number[] = Array(24).fill(0);
  transactions.forEach((t) => {
    if (t.start_time) {
      const h = new Date(t.start_time).getHours();
      hourMap[h]++;
    }
  });
  const peakHour = hourMap.indexOf(Math.max(...hourMap));
  const maxHourSessions = Math.max(...hourMap, 1);

  // ── Calcular top usuarios ────────────────────────────────────────────────────
  const userMap: Record<string, { name: string; email: string; sessions: number; kwh: number; revenue: number }> = {};
  transactions.forEach((t) => {
    const key = t.user_email || `user-${t.id}`;
    if (!userMap[key]) userMap[key] = { name: t.user_name || "Anónimo", email: t.user_email || "—", sessions: 0, kwh: 0, revenue: 0 };
    userMap[key].sessions++;
    userMap[key].kwh += parseFloat(String(t.energy_kwh || 0));
    userMap[key].revenue += parseFloat(String(t.total_cost || 0));
  });
  const topUsers = Object.values(userMap).sort((a, b) => b.sessions - a.sessions).slice(0, 10);

  // ── Estado de sesiones ───────────────────────────────────────────────────────
  const statusMap: Record<string, number> = {};
  transactions.forEach((t) => {
    const s = t.status || "UNKNOWN";
    statusMap[s] = (statusMap[s] || 0) + 1;
  });

  // ── Tendencia diaria ─────────────────────────────────────────────────────────
  const dailyMap: Record<string, { day: string; sessions: number; kwh: number; revenue: number }> = {};
  transactions.forEach((t) => {
    if (!t.start_time) return;
    const day = new Date(t.start_time).toLocaleDateString("es-CO", { month: "short", day: "numeric" });
    if (!dailyMap[day]) dailyMap[day] = { day, sessions: 0, kwh: 0, revenue: 0 };
    dailyMap[day].sessions++;
    dailyMap[day].kwh += parseFloat(String(t.energy_kwh || 0));
    dailyMap[day].revenue += parseFloat(String(t.total_cost || 0));
  });
  const dailyTrend = Object.values(dailyMap).slice(-14);
  const maxDailySessions = Math.max(...dailyTrend.map(d => d.sessions), 1);

  // ── Promedio por sesión ──────────────────────────────────────────────────────
  const avgRevenue = stats.totalSessions > 0 ? stats.totalRevenue / stats.totalSessions : 0;
  const completedCount = statusMap["COMPLETED"] || 0;
  const completionRate = stats.totalSessions > 0 ? ((completedCount / stats.totalSessions) * 100).toFixed(1) : "0";

  // ── Generar filas de transacciones ───────────────────────────────────────────
  const txRows = transactions.slice(0, 500).map((t, i) => `
    <tr class="${i % 2 === 0 ? "even" : ""}">
      <td>${t.id}</td>
      <td>${t.station_name || `#${t.station_id}`}</td>
      <td>${t.user_name || "Anónimo"}</td>
      <td>${t.user_email || "—"}</td>
      <td>${formatDate(t.start_time || null)}</td>
      <td>${formatDate(t.end_time || null)}</td>
      <td class="num">${parseFloat(String(t.energy_kwh || 0)).toFixed(2)}</td>
      <td class="num">${formatCOP(parseFloat(String(t.total_cost || 0)))}</td>
      <td><span class="badge" style="background:${statusColor(t.status || "")}20;color:${statusColor(t.status || "")};border:1px solid ${statusColor(t.status || "")}40">${statusLabel(t.status || "—")}</span></td>
    </tr>`).join("");

  // ── Generar filas de estaciones ──────────────────────────────────────────────
  const stationRows = stations.map((s, i) => {
    const sStat = stationMap[s.name] || { sessions: 0, kwh: 0, revenue: 0 };
    const connCount = s.evses?.length || 0;
    return `
    <tr class="${i % 2 === 0 ? "even" : ""}">
      <td>${s.name}</td>
      <td>${s.address || "—"}</td>
      <td>${s.city || "—"}</td>
      <td class="center">${connCount}</td>
      <td class="center"><span class="badge" style="background:${s.isActive ? "#16a34a20" : "#6b728020"};color:${s.isActive ? "#16a34a" : "#6b7280"};border:1px solid ${s.isActive ? "#16a34a40" : "#6b728040"}">${s.isActive ? "Activa" : "Inactiva"}</span></td>
      <td class="num">${sStat.sessions}</td>
      <td class="num">${sStat.kwh.toFixed(1)}</td>
      <td class="num">${formatCOP(sStat.revenue)}</td>
    </tr>`;
  }).join("");

  // ── Barras de distribución horaria ───────────────────────────────────────────
  const hourBars = hourMap.map((count, h) => {
    const pct = Math.round((count / maxHourSessions) * 100);
    const isPeak = h === peakHour;
    return `<div class="hour-bar-col">
      <div class="hour-bar-wrap">
        <div class="hour-bar" style="height:${pct}%;background:${isPeak ? "#16a34a" : "#22c55e60"}" title="${h}:00 - ${count} sesiones"></div>
      </div>
      <div class="hour-label">${h % 3 === 0 ? h + "h" : ""}</div>
    </div>`;
  }).join("");

  // ── Barras de tendencia diaria ───────────────────────────────────────────────
  const dailyBars = dailyTrend.map((d) => {
    const pct = Math.round((d.sessions / maxDailySessions) * 100);
    return `<div class="day-bar-col">
      <div class="day-bar-wrap">
        <div class="day-bar" style="height:${pct}%" title="${d.day} - ${d.sessions} sesiones"></div>
      </div>
      <div class="day-label">${d.day}</div>
    </div>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Reporte Ejecutivo EVGreen — ${org.name}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #111; font-size: 12px; }
  
  /* ── Portada ── */
  .cover { background: linear-gradient(135deg, #0a1628 0%, #0d2818 50%, #0a1628 100%); color: white; padding: 60px 48px; min-height: 200px; display: flex; align-items: center; justify-content: space-between; }
  .cover-left h1 { font-size: 28px; font-weight: 800; color: #22c55e; letter-spacing: -0.5px; }
  .cover-left h2 { font-size: 18px; font-weight: 600; color: #fff; margin-top: 6px; }
  .cover-left .meta { font-size: 11px; color: #9ca3af; margin-top: 12px; line-height: 1.8; }
  .cover-right { text-align: right; }
  .cover-right .period-badge { background: #16a34a; color: white; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; display: inline-block; }
  .cover-right .plan-badge { background: rgba(255,255,255,0.1); color: #d1fae5; padding: 4px 12px; border-radius: 12px; font-size: 11px; margin-top: 8px; display: inline-block; }

  /* ── Secciones ── */
  .section { padding: 28px 48px; border-bottom: 1px solid #f0f0f0; }
  .section:last-child { border-bottom: none; }
  .section-title { font-size: 14px; font-weight: 700; color: #16a34a; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
  .section-title::before { content: ''; display: inline-block; width: 4px; height: 16px; background: #16a34a; border-radius: 2px; }

  /* ── KPI Grid ── */
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 8px; }
  .kpi-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .kpi { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 14px 16px; }
  .kpi-label { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.3px; }
  .kpi-value { font-size: 22px; font-weight: 800; color: #15803d; margin-top: 4px; }
  .kpi-sub { font-size: 10px; color: #9ca3af; margin-top: 2px; }
  .kpi-blue { background: #eff6ff; border-color: #bfdbfe; }
  .kpi-blue .kpi-value { color: #1d4ed8; }
  .kpi-amber { background: #fffbeb; border-color: #fde68a; }
  .kpi-amber .kpi-value { color: #b45309; }
  .kpi-purple { background: #faf5ff; border-color: #e9d5ff; }
  .kpi-purple .kpi-value { color: #7c3aed; }

  /* ── Tablas ── */
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 8px; }
  th { background: #f0fdf4; padding: 8px 10px; text-align: left; font-weight: 700; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; color: #374151; border-bottom: 2px solid #bbf7d0; }
  td { padding: 7px 10px; border-bottom: 1px solid #f3f4f6; vertical-align: middle; }
  tr.even td { background: #f9fafb; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .center { text-align: center; }

  /* ── Badge ── */
  .badge { padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; white-space: nowrap; }

  /* ── Gráficas de barras ── */
  .chart-container { display: flex; align-items: flex-end; gap: 3px; height: 80px; padding: 0 4px; }
  .hour-bar-col, .day-bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; }
  .hour-bar-wrap, .day-bar-wrap { flex: 1; display: flex; align-items: flex-end; width: 100%; }
  .hour-bar, .day-bar { width: 100%; border-radius: 2px 2px 0 0; min-height: 2px; }
  .day-bar { background: #22c55e60; }
  .hour-label, .day-label { font-size: 8px; color: #9ca3af; margin-top: 2px; text-align: center; white-space: nowrap; }

  /* ── Distribución de estados ── */
  .status-row { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 8px; }
  .status-item { display: flex; align-items: center; gap: 6px; font-size: 11px; }
  .status-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }

  /* ── Dos columnas ── */
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
  .col-title { font-size: 11px; font-weight: 700; color: #374151; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.3px; }

  /* ── Footer ── */
  .footer { background: #f9fafb; padding: 16px 48px; text-align: center; font-size: 10px; color: #9ca3af; border-top: 1px solid #e5e7eb; }

  /* ── Print ── */
  @media print {
    body { font-size: 11px; }
    .section { padding: 20px 32px; }
    .cover { padding: 40px 32px; }
    .footer { padding: 12px 32px; }
    .page-break { page-break-before: always; }
  }
</style>
</head>
<body>

<!-- ══ PORTADA ══════════════════════════════════════════════════════════════ -->
<div class="cover">
  <div class="cover-left">
    <h1>⚡ EVGreen Platform</h1>
    <h2>Reporte Ejecutivo — ${org.name}</h2>
    <div class="meta">
      Período: ${periodLabel[period] || period}<br>
      Generado: ${new Date().toLocaleString("es-CO", { dateStyle: "long", timeStyle: "short" })}<br>
      Plan: ${org.plan?.toUpperCase() || "—"} · Estado: ${org.status || "—"}
    </div>
  </div>
  <div class="cover-right">
    <div class="period-badge">${periodLabel[period] || period}</div><br>
    <div class="plan-badge">Plan ${org.plan?.toUpperCase() || "—"}</div>
  </div>
</div>

<!-- ══ SECCIÓN 1: RESUMEN EJECUTIVO ════════════════════════════════════════ -->
<div class="section">
  <div class="section-title">Resumen Ejecutivo</div>
  <div class="kpi-grid">
    <div class="kpi">
      <div class="kpi-label">Sesiones totales</div>
      <div class="kpi-value">${stats.totalSessions.toLocaleString("es-CO")}</div>
      <div class="kpi-sub">Tasa de completado: ${completionRate}%</div>
    </div>
    <div class="kpi kpi-blue">
      <div class="kpi-label">kWh entregados</div>
      <div class="kpi-value">${stats.totalKwh.toFixed(1)}</div>
      <div class="kpi-sub">Prom. ${stats.avgKwhPerSession.toFixed(2)} kWh/sesión</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Ingresos brutos</div>
      <div class="kpi-value">${formatCOP(stats.totalRevenue)}</div>
      <div class="kpi-sub">Prom. ${formatCOP(avgRevenue)}/sesión</div>
    </div>
    <div class="kpi kpi-purple">
      <div class="kpi-label">Usuarios únicos</div>
      <div class="kpi-value">${stats.uniqueUsers}</div>
      <div class="kpi-sub">Sesiones activas: ${completedCount}</div>
    </div>
  </div>
</div>

<!-- ══ SECCIÓN 2: REPORTE FINANCIERO ═══════════════════════════════════════ -->
<div class="section">
  <div class="section-title">Reporte Financiero</div>
  <div class="two-col">
    <div>
      <div class="col-title">Ingresos por estación</div>
      <table>
        <thead><tr><th>Estación</th><th class="num">Sesiones</th><th class="num">kWh</th><th class="num">Ingresos</th></tr></thead>
        <tbody>
          ${stationStats.map((s, i) => `
          <tr class="${i % 2 === 0 ? "even" : ""}">
            <td>${s.name}</td>
            <td class="num">${s.sessions}</td>
            <td class="num">${s.kwh.toFixed(1)}</td>
            <td class="num">${formatCOP(s.revenue)}</td>
          </tr>`).join("") || '<tr><td colspan="4" style="text-align:center;color:#9ca3af">Sin datos</td></tr>'}
        </tbody>
      </table>
    </div>
    <div>
      <div class="col-title">Estado de sesiones</div>
      <div class="status-row">
        ${Object.entries(statusMap).map(([s, count]) => `
        <div class="status-item">
          <div class="status-dot" style="background:${statusColor(s)}"></div>
          <span>${statusLabel(s)}: <strong>${count}</strong></span>
        </div>`).join("") || '<span style="color:#9ca3af;font-size:11px">Sin datos</span>'}
      </div>
      ${dailyTrend.length > 0 ? `
      <div style="margin-top:16px">
        <div class="col-title">Tendencia diaria (últimas ${dailyTrend.length} fechas)</div>
        <div class="chart-container">${dailyBars}</div>
      </div>` : ""}
    </div>
  </div>
</div>

<!-- ══ SECCIÓN 3: ANALÍTICA DE USO ═════════════════════════════════════════ -->
<div class="section">
  <div class="section-title">Analítica de Uso</div>
  <div class="two-col">
    <div>
      <div class="col-title">Distribución por hora del día · Hora pico: ${peakHour}:00 (${hourMap[peakHour]} sesiones)</div>
      <div class="chart-container">${hourBars}</div>
    </div>
    <div>
      <div class="col-title">Top ${topUsers.length} usuarios por sesiones</div>
      <table>
        <thead><tr><th>#</th><th>Usuario</th><th class="num">Sesiones</th><th class="num">kWh</th><th class="num">Total</th></tr></thead>
        <tbody>
          ${topUsers.map((u, i) => `
          <tr class="${i % 2 === 0 ? "even" : ""}">
            <td class="center">${i + 1}</td>
            <td>${u.name}<br><span style="color:#9ca3af;font-size:10px">${u.email}</span></td>
            <td class="num">${u.sessions}</td>
            <td class="num">${u.kwh.toFixed(1)}</td>
            <td class="num">${formatCOP(u.revenue)}</td>
          </tr>`).join("") || '<tr><td colspan="5" style="text-align:center;color:#9ca3af">Sin datos</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>
</div>

<!-- ══ SECCIÓN 4: ESTADO DE ESTACIONES ═════════════════════════════════════ -->
<div class="section page-break">
  <div class="section-title">Estado de Estaciones</div>
  <table>
    <thead>
      <tr>
        <th>Nombre</th><th>Dirección</th><th>Ciudad</th>
        <th class="center">Conectores</th><th class="center">Estado</th>
        <th class="num">Sesiones</th><th class="num">kWh</th><th class="num">Ingresos</th>
      </tr>
    </thead>
    <tbody>
      ${stationRows || '<tr><td colspan="8" style="text-align:center;color:#9ca3af">Sin estaciones</td></tr>'}
    </tbody>
  </table>
</div>

<!-- ══ SECCIÓN 5: TRANSACCIONES DETALLADAS ═════════════════════════════════ -->
<div class="section page-break">
  <div class="section-title">Transacciones Detalladas${transactions.length > 500 ? ` (mostrando 500 de ${transactions.length})` : ` (${transactions.length} registros)`}</div>
  <table>
    <thead>
      <tr>
        <th>#ID</th><th>Estación</th><th>Usuario</th><th>Email</th>
        <th>Inicio</th><th>Fin</th>
        <th class="num">kWh</th><th class="num">Total COP</th><th>Estado</th>
      </tr>
    </thead>
    <tbody>
      ${txRows || '<tr><td colspan="9" style="text-align:center;color:#9ca3af">Sin transacciones en el período</td></tr>'}
    </tbody>
  </table>
</div>

<!-- ══ FOOTER ════════════════════════════════════════════════════════════════ -->
<div class="footer">
  EVGreen Platform · evgreen.lat · evgreen@greenhproject.com · Reporte generado el ${new Date().toLocaleString("es-CO")}
</div>

</body>
</html>`;
}

/**
 * Genera CSV completo con todas las transacciones + resumen por estación
 */
export function generateOrgReportCsv(data: OrgReportData): string {
  const { org, period, stats, transactions, stations } = data;
  const periodLabel: Record<string, string> = {
    "7d": "Últimos 7 días", "30d": "Últimos 30 días", "90d": "Últimos 90 días", "all": "Todo el tiempo",
  };

  const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;

  const lines: string[] = [];

  // Encabezado del reporte
  lines.push(esc("REPORTE EJECUTIVO EVGREEN"));
  lines.push(`${esc("Organización")},${esc(org.name)}`);
  lines.push(`${esc("Período")},${esc(periodLabel[period] || period)}`);
  lines.push(`${esc("Generado")},${esc(new Date().toLocaleString("es-CO"))}`);
  lines.push(`${esc("Plan")},${esc(org.plan?.toUpperCase() || "—")}`);
  lines.push("");

  // Resumen ejecutivo
  lines.push(esc("RESUMEN EJECUTIVO"));
  lines.push(`${esc("Sesiones totales")},${esc(stats.totalSessions)}`);
  lines.push(`${esc("kWh entregados")},${esc(stats.totalKwh.toFixed(2))}`);
  lines.push(`${esc("Ingresos brutos COP")},${esc(stats.totalRevenue.toFixed(0))}`);
  lines.push(`${esc("Promedio kWh/sesión")},${esc(stats.avgKwhPerSession.toFixed(2))}`);
  lines.push(`${esc("Usuarios únicos")},${esc(stats.uniqueUsers)}`);
  lines.push("");

  // Resumen por estación
  lines.push(esc("RESUMEN POR ESTACIÓN"));
  lines.push([esc("Estación"), esc("Sesiones"), esc("kWh"), esc("Ingresos COP"), esc("Completadas"), esc("Canceladas")].join(","));
  const stationMap: Record<string, { sessions: number; kwh: number; revenue: number; completed: number; cancelled: number }> = {};
  transactions.forEach((t) => {
    const key = t.station_name || `Estación #${t.station_id}`;
    if (!stationMap[key]) stationMap[key] = { sessions: 0, kwh: 0, revenue: 0, completed: 0, cancelled: 0 };
    stationMap[key].sessions++;
    stationMap[key].kwh += parseFloat(String(t.energy_kwh || 0));
    stationMap[key].revenue += parseFloat(String(t.total_cost || 0));
    if (t.status === "COMPLETED") stationMap[key].completed++;
    if (t.status === "CANCELLED") stationMap[key].cancelled++;
  });
  Object.entries(stationMap).forEach(([name, s]) => {
    lines.push([esc(name), esc(s.sessions), esc(s.kwh.toFixed(2)), esc(s.revenue.toFixed(0)), esc(s.completed), esc(s.cancelled)].join(","));
  });
  lines.push("");

  // Transacciones detalladas
  lines.push(esc("TRANSACCIONES DETALLADAS"));
  lines.push([esc("ID"), esc("Estación"), esc("Usuario"), esc("Email"), esc("Inicio"), esc("Fin"), esc("kWh"), esc("Total COP"), esc("Estado")].join(","));
  transactions.forEach((t) => {
    lines.push([
      esc(t.id),
      esc(t.station_name || `#${t.station_id}`),
      esc(t.user_name || "Anónimo"),
      esc(t.user_email || ""),
      esc(t.start_time ? new Date(t.start_time).toLocaleString("es-CO") : ""),
      esc(t.end_time ? new Date(t.end_time).toLocaleString("es-CO") : ""),
      esc(parseFloat(String(t.energy_kwh || 0)).toFixed(2)),
      esc(parseFloat(String(t.total_cost || 0)).toFixed(0)),
      esc(t.status || ""),
    ].join(","));
  });

  return "\uFEFF" + lines.join("\n"); // BOM para Excel
}
