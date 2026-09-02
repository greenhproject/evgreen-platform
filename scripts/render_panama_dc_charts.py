"""Genera gráficos del modelo preliminar de carga DC de Panamá."""

from __future__ import annotations

import json
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np


DOCS = Path(__file__).resolve().parent.parent / "docs"
DATA = json.loads((DOCS / "panama-dc-fast-charging-model.json").read_text(encoding="utf-8"))

plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 10})
GREEN = "#10B981"
LIME = "#84CC16"
NAVY = "#0F172A"
SLATE = "#64748B"
RED = "#EF4444"
BLUE = "#38BDF8"


def save_scenario_chart() -> None:
    rows = DATA["edemet_scenarios"]
    labels = [row["scenario"] for row in rows]
    energy_cost = np.array([row["total_grid_cost_b_month"] - row["demand_cost_b_month"] for row in rows])
    demand_cost = np.array([row["demand_cost_b_month"] for row in rows])
    revenue = np.array([row["revenue_b_month"] for row in rows])
    x = np.arange(len(rows))

    fig, ax = plt.subplots(figsize=(11, 6.2), dpi=220)
    fig.patch.set_facecolor("white")
    ax.bar(x - 0.19, revenue, width=0.38, label="Ingreso por carga", color=GREEN)
    ax.bar(x + 0.19, energy_cost, width=0.38, label="Energía + pérdidas", color=BLUE)
    ax.bar(x + 0.19, demand_cost, bottom=energy_cost, width=0.38, label="Demanda + fijo", color=NAVY)
    for i, row in enumerate(rows):
        contribution = row["contribution_after_grid_b_month"]
        label_y = revenue[i] * 0.52 if i == 2 else max(revenue[i], energy_cost[i] + demand_cost[i]) + 280
        label = f"Aporte neto\nB/.{contribution:,.0f}" if i == 2 else f"Contribución\nB/.{contribution:,.0f}"
        ax.text(i, label_y,
                label, ha="center", va="bottom",
                color="white" if i == 2 else (GREEN if contribution >= 0 else RED), fontweight="bold")
    ax.set_title("EDEMET: el costo de demanda define la economía de una estación DC", loc="left", fontsize=15, fontweight="bold", color=NAVY)
    ax.set_ylabel("B/. por mes")
    ax.set_xticks(x, labels)
    ax.grid(axis="y", alpha=0.2)
    ax.spines[["top", "right", "left"]].set_visible(False)
    ax.legend(ncol=3, frameon=False, loc="upper left")
    ax.text(0, -0.20,
            "Supuestos: cargador 120 kW, 30 días, 92% eficiencia, demanda facturada 120 kW; costo de red según MTD 2026 de EDEMET.\n"
            "No incluye arriendo, equipo, mantenimiento, software, medios de pago, impuestos ni deuda.",
            transform=ax.transAxes, color=SLATE, fontsize=8.5)
    fig.tight_layout()
    fig.savefig(DOCS / "panama-scenario-grid-cost.png", bbox_inches="tight")
    plt.close(fig)


def save_zone_chart() -> None:
    rows = DATA["zone_sensitivity_base_case"]
    zones = [row["zone"] for row in rows]
    effective_cost = [row["effective_grid_cost_b_per_delivered_kwh"] for row in rows]
    contribution = [row["contribution_after_grid_b_month"] for row in rows]
    x = np.arange(len(rows))
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11, 4.8), dpi=220, gridspec_kw={"width_ratios": [1, 1.2]})
    fig.patch.set_facecolor("white")
    bars = ax1.bar(zones, effective_cost, color=[NAVY, GREEN, LIME])
    ax1.axhline(0.425, color=SLATE, linestyle="--", linewidth=1.5, label="Precio público base: B/.0,425")
    ax1.set_title("Costo efectivo de red", loc="left", fontweight="bold", color=NAVY)
    ax1.set_ylabel("B/. por kWh entregado")
    ax1.set_ylim(0, 0.5)
    ax1.legend(frameon=False, fontsize=8)
    ax1.grid(axis="y", alpha=0.2)
    ax1.spines[["top", "right", "left"]].set_visible(False)
    for bar, value in zip(bars, effective_cost):
        ax1.text(bar.get_x() + bar.get_width()/2, value + .012, f"B/.{value:.3f}", ha="center", fontsize=9, fontweight="bold")

    colors = [GREEN if value >= 0 else RED for value in contribution]
    bars = ax2.bar(zones, contribution, color=colors)
    ax2.axhline(0, color=SLATE, linewidth=0.9)
    ax2.set_title("Contribución mensual después de red", loc="left", fontweight="bold", color=NAVY)
    ax2.set_ylabel("B/. por mes")
    ax2.grid(axis="y", alpha=0.2)
    ax2.spines[["top", "right", "left"]].set_visible(False)
    for bar, value in zip(bars, contribution):
        ax2.text(bar.get_x() + bar.get_width()/2, value + 80, f"B/.{value:,.0f}", ha="center", fontsize=9, fontweight="bold")
    fig.suptitle("Sensibilidad territorial — caso base de 15% de utilización", x=.055, y=1.02, ha="left", fontsize=15, fontweight="bold", color=NAVY)
    fig.text(.055, -.01, "La diferencia procede de tarifas MTD y CVC de agosto de 2026. Es referencia histórica: validar el pliego vigente, estudio de conexión y perfil de demanda del sitio.", fontsize=8.5, color=SLATE)
    fig.tight_layout()
    fig.savefig(DOCS / "panama-zone-sensitivity.png", bbox_inches="tight")
    plt.close(fig)


def save_break_even_chart() -> None:
    rows = DATA["edemet_break_even_utilization"]
    prices = [row["sale_price_b_per_kwh"] for row in rows]
    utilization = [row["break_even_utilization"] * 100 for row in rows]
    fig, ax = plt.subplots(figsize=(8.5, 5.2), dpi=220)
    fig.patch.set_facecolor("white")
    ax.plot(prices, utilization, marker="o", color=GREEN, linewidth=3, markersize=9)
    for price, use in zip(prices, utilization):
        ax.annotate(f"{use:.1f}%", (price, use), textcoords="offset points", xytext=(0, 10), ha="center", fontweight="bold", color=NAVY)
    ax.set_title("EDEMET: mayor precio reduce la utilización mínima de equilibrio", loc="left", fontsize=14, fontweight="bold", color=NAVY)
    ax.set_xlabel("Precio público de carga (B/./kWh)")
    ax.set_ylabel("Utilización mínima mensual (%)")
    ax.set_xlim(0.33, 0.52)
    ax.set_ylim(0, 19)
    ax.grid(alpha=0.2)
    ax.spines[["top", "right", "left"]].set_visible(False)
    ax.text(.01, -.20, "Equilibrio de energía + demanda + cargo fijo únicamente. No incluye OPEX, impuestos, amortización ni retorno de inversión.", transform=ax.transAxes, color=SLATE, fontsize=8.5)
    fig.tight_layout()
    fig.savefig(DOCS / "panama-edemet-break-even.png", bbox_inches="tight")
    plt.close(fig)


if __name__ == "__main__":
    save_scenario_chart()
    save_zone_chart()
    save_break_even_chart()
