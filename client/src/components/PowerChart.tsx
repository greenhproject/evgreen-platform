/**
 * PowerChart - Gráfico de potencia en tiempo real durante la sesión de carga
 * 
 * Muestra una línea de tiempo con:
 * - Potencia (kW) en el eje Y principal
 * - SoC (%) en el eje Y secundario (si disponible)
 * - Energía acumulada (kWh) como área bajo la curva
 * 
 * Se actualiza automáticamente con los datos del endpoint getActiveSession
 */

import { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Title,
  Tooltip,
  Legend,
  type ChartOptions,
  type ChartData,
} from "chart.js";
import { Line } from "react-chartjs-2";

// Registrar componentes de Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Title,
  Tooltip,
  Legend
);

interface PowerHistoryPoint {
  timestamp: number;
  power: number;
  energy: number;
  soc: number | null;
}

interface PowerChartProps {
  powerHistory: PowerHistoryPoint[];
  startTime: string;
  nominalPower?: number;
}

export function PowerChart({ powerHistory, startTime, nominalPower = 7 }: PowerChartProps) {
  const chartData = useMemo<ChartData<"line">>(() => {
    if (!powerHistory || powerHistory.length === 0) {
      return {
        labels: [],
        datasets: [],
      };
    }

    const startMs = new Date(startTime).getTime();
    
    // Formatear labels como minutos desde inicio
    const labels = powerHistory.map((p) => {
      const minutesElapsed = Math.floor((p.timestamp - startMs) / 60000);
      const seconds = Math.floor(((p.timestamp - startMs) % 60000) / 1000);
      if (minutesElapsed < 1) return `${seconds}s`;
      return `${minutesElapsed}m`;
    });

    const hasSoc = powerHistory.some((p) => p.soc !== null);

    const datasets: ChartData<"line">["datasets"] = [
      {
        label: "Potencia (kW)",
        data: powerHistory.map((p) => Math.round(p.power * 10) / 10),
        borderColor: "rgb(245, 158, 11)",
        backgroundColor: "rgba(245, 158, 11, 0.1)",
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.3,
        fill: true,
        yAxisID: "y",
      },
      {
        label: "Energía (kWh)",
        data: powerHistory.map((p) => Math.round(p.energy * 100) / 100),
        borderColor: "rgb(59, 130, 246)",
        backgroundColor: "rgba(59, 130, 246, 0.05)",
        borderWidth: 1.5,
        pointRadius: 0,
        pointHoverRadius: 3,
        tension: 0.3,
        fill: false,
        borderDash: [4, 4],
        yAxisID: "y",
      },
    ];

    if (hasSoc) {
      datasets.push({
        label: "Batería (%)",
        data: powerHistory.map((p) => p.soc),
        borderColor: "rgb(16, 185, 129)",
        backgroundColor: "rgba(16, 185, 129, 0.05)",
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.3,
        fill: false,
        yAxisID: "y1",
      });
    }

    return { labels, datasets };
  }, [powerHistory, startTime]);

  const options = useMemo<ChartOptions<"line">>(() => {
    const hasSoc = powerHistory?.some((p) => p.soc !== null);
    const maxPower = powerHistory?.length
      ? Math.max(...powerHistory.map((p) => p.power), nominalPower) * 1.2
      : nominalPower * 1.2;

    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false,
      },
      plugins: {
        legend: {
          display: true,
          position: "bottom",
          labels: {
            boxWidth: 12,
            padding: 8,
            font: { size: 10 },
            usePointStyle: true,
          },
        },
        tooltip: {
          backgroundColor: "rgba(0,0,0,0.8)",
          titleFont: { size: 11 },
          bodyFont: { size: 11 },
          padding: 8,
          callbacks: {
            label: (context) => {
              const label = context.dataset.label || "";
              const value = context.parsed.y;
              if (value == null) return ` ${label}: --`;
              if (label.includes("Potencia")) return ` ${label}: ${value.toFixed(1)} kW`;
              if (label.includes("Energía")) return ` ${label}: ${value.toFixed(2)} kWh`;
              if (label.includes("Batería")) return ` ${label}: ${value}%`;
              return ` ${label}: ${value}`;
            },
          },
        },
        title: {
          display: false,
        },
      },
      scales: {
        x: {
          display: true,
          grid: {
            display: false,
          },
          ticks: {
            font: { size: 9 },
            maxTicksLimit: 8,
            maxRotation: 0,
          },
        },
        y: {
          type: "linear",
          display: true,
          position: "left",
          min: 0,
          max: Math.ceil(maxPower),
          grid: {
            color: "rgba(0,0,0,0.06)",
          },
          ticks: {
            font: { size: 9 },
            callback: (value) => `${value} kW`,
          },
          title: {
            display: false,
          },
        },
        ...(hasSoc
          ? {
              y1: {
                type: "linear" as const,
                display: true,
                position: "right" as const,
                min: 0,
                max: 100,
                grid: {
                  drawOnChartArea: false,
                },
                ticks: {
                  font: { size: 9 },
                  callback: (value: string | number) => value != null ? `${value}%` : '',
                },
              },
            }
          : {}),
      },
      animation: {
        duration: 300,
      },
    };
  }, [powerHistory, nominalPower]);

  if (!powerHistory || powerHistory.length < 2) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        <div className="text-center">
          <p>Esperando datos de potencia...</p>
          <p className="text-xs mt-1">El gráfico aparecerá cuando el cargador envíe datos</p>
        </div>
      </div>
    );
  }

  return <Line data={chartData} options={options} />;
}
