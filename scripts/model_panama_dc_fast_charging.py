"""Modelo reproducible para la evaluación preliminar de una estación DC en Panamá.

No sustituye una cotización de conexión, el pliego vigente del semestre ni un
contrato de energía. Todas las cifras se expresan en balboas (B/.), 1:1 con USD.
"""

from __future__ import annotations

import csv
import json
from pathlib import Path


OUTPUT_DIR = Path(__file__).resolve().parent.parent / "docs"

CHARGER_KW = 120
DAYS_PER_MONTH = 30
DELIVERY_EFFICIENCY = 0.92
ASSUMED_BILLED_DEMAND_KW = 120

# Publicado por ASEP para enero-agosto de 2026. CVC de agosto 2026.
# Estas tarifas son una referencia histórica inmediata al 1-sep-2026 y se deben
# sustituir con el pliego vigente de la distribuidora antes de comprometer CAPEX.
TARIFFS = {
    "EDEMET": {"energy": 0.16001, "cvc": -0.00915, "demand": 20.62, "fixed": 14.27},
    "ENSA": {"energy": 0.15396, "cvc": 0.00052, "demand": 12.45, "fixed": 9.06},
    "EDECHI": {"energy": 0.13479, "cvc": -0.01510, "demand": 24.53, "fixed": 14.21},
}

# No son pronósticos. Son casos de sensibilidad para ligar tarifa al uso real.
SCENARIOS = (
    {"name": "Conservador", "utilization": 0.05, "sale_price": 0.35},
    {"name": "Base", "utilization": 0.15, "sale_price": 0.425},
    {"name": "Alto uso", "utilization": 0.30, "sale_price": 0.50},
)


def calculate(zone: str, utilization: float, sale_price: float) -> dict[str, float | str]:
    tariff = TARIFFS[zone]
    delivered_kwh = CHARGER_KW * 24 * DAYS_PER_MONTH * utilization
    purchased_kwh = delivered_kwh / DELIVERY_EFFICIENCY
    energy_rate = tariff["energy"] + tariff["cvc"]
    energy_cost = purchased_kwh * energy_rate
    demand_cost = ASSUMED_BILLED_DEMAND_KW * tariff["demand"]
    total_grid_cost = energy_cost + demand_cost + tariff["fixed"]
    revenue = delivered_kwh * sale_price
    contribution_after_grid = revenue - total_grid_cost
    return {
        "zone": zone,
        "delivered_kwh_month": round(delivered_kwh, 2),
        "purchased_kwh_month": round(purchased_kwh, 2),
        "energy_rate_b_per_kwh": round(energy_rate, 5),
        "demand_cost_b_month": round(demand_cost, 2),
        "total_grid_cost_b_month": round(total_grid_cost, 2),
        "effective_grid_cost_b_per_delivered_kwh": round(total_grid_cost / delivered_kwh, 4),
        "sale_price_b_per_kwh": sale_price,
        "revenue_b_month": round(revenue, 2),
        "contribution_after_grid_b_month": round(contribution_after_grid, 2),
    }


def break_even(zone: str, sale_price: float) -> dict[str, float | str]:
    """Calcula el uso mínimo para cubrir el cargo de red, antes de OPEX."""
    tariff = TARIFFS[zone]
    variable_cost_per_delivered_kwh = (tariff["energy"] + tariff["cvc"]) / DELIVERY_EFFICIENCY
    monthly_fixed_grid_cost = ASSUMED_BILLED_DEMAND_KW * tariff["demand"] + tariff["fixed"]
    if sale_price <= variable_cost_per_delivered_kwh:
        raise ValueError("El precio público no cubre el costo variable de red.")
    delivered_kwh = monthly_fixed_grid_cost / (sale_price - variable_cost_per_delivered_kwh)
    denominator = CHARGER_KW * 24 * DAYS_PER_MONTH
    return {
        "zone": zone,
        "sale_price_b_per_kwh": sale_price,
        "variable_grid_cost_b_per_delivered_kwh": round(variable_cost_per_delivered_kwh, 4),
        "fixed_grid_cost_b_month": round(monthly_fixed_grid_cost, 2),
        "break_even_delivered_kwh_month": round(delivered_kwh, 2),
        "break_even_utilization": round(delivered_kwh / denominator, 4),
    }


def main() -> None:
    scenarios = []
    for scenario in SCENARIOS:
        result = calculate("EDEMET", scenario["utilization"], scenario["sale_price"])
        result.update({"scenario": scenario["name"], "utilization": scenario["utilization"]})
        scenarios.append(result)

    zone_sensitivity = []
    for zone in TARIFFS:
        result = calculate(zone, 0.15, 0.425)
        result.update({"scenario": "Base", "utilization": 0.15})
        zone_sensitivity.append(result)

    break_even_utilization = [
        break_even("EDEMET", sale_price) for sale_price in (0.35, 0.425, 0.50)
    ]

    payload = {
        "assumptions": {
            "charger_kw": CHARGER_KW,
            "days_per_month": DAYS_PER_MONTH,
            "delivery_efficiency": DELIVERY_EFFICIENCY,
            "assumed_billed_demand_kw": ASSUMED_BILLED_DEMAND_KW,
            "currency": "PAB/USD",
        },
        "edemet_scenarios": scenarios,
        "zone_sensitivity_base_case": zone_sensitivity,
        "edemet_break_even_utilization": break_even_utilization,
    }
    (OUTPUT_DIR / "panama-dc-fast-charging-model.json").write_text(
        json.dumps(payload, indent=2), encoding="utf-8"
    )

    with (OUTPUT_DIR / "panama-dc-fast-charging-model.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=scenarios[0].keys())
        writer.writeheader()
        writer.writerows(scenarios)


if __name__ == "__main__":
    main()
