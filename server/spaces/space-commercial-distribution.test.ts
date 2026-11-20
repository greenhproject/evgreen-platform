import { describe, expect, it } from 'vitest';
import { resolveSpaceCommercialDistribution, validateSpaceDistributionPatch, spaceDistributionColumns } from '../../shared/space-commercial-distribution';
import { buildSpaceTrafficProjection } from '../../shared/space-traffic-financial-projection';

const base = { investmentCop: 1_000_000_000, estimatedDailyVehicles: 700, estimatedEvPercent: 10, chargerCount: 2, totalPowerKw: 240, operatingHoursPerDay: 24, efficiencyPercent: 92, spaceType: 'parking', salePricePerKwh: 1800, energyCostPerKwh: 850 };
describe('distribución económica canónica del espacio', () => {
  it('sugiere EDS60/40 y otros70/30 solo cuando no hay acuerdo', () => {
    expect(resolveSpaceCommercialDistribution({ spaceType: 'gas_station' })).toEqual({ allySharePercent: 10, investorSharePercent: 60, evgreenSharePercent: 40, source: 'DEFAULT' });
    expect(resolveSpaceCommercialDistribution({ spaceType: 'parking' }).investorSharePercent).toBe(70);
  });
  it('hereda el proyecto vinculado sin reemplazar ceros', () => {
    expect(resolveSpaceCommercialDistribution({ spaceType: 'gas_station' }, { hostSharePercent: '0.00', investorSharePercent: '82.25', evgreenSharePercent: '17.75' })).toEqual({ allySharePercent: 0, investorSharePercent: 82.25, evgreenSharePercent: 17.75, source: 'PROJECT' });
  });
  it.each([false, true])('hereda assumptions reales del snapshot, incluyendo cero, JSON texto=%s', asText => {
    const snapshot = { assumptions: { hostSharePercent: 0, investorSharePercent: 62.25, evgreenSharePercent: 37.75 } };
    const project = { financialProjectionSnapshot: asText ? JSON.stringify(snapshot) : snapshot, hostSharePercent: 10, investorSharePercent: 60, evgreenSharePercent: 40 };
    expect(resolveSpaceCommercialDistribution({ spaceType: 'gas_station' }, project)).toEqual({ allySharePercent: 0, investorSharePercent: 62.25, evgreenSharePercent: 37.75, source: 'PROJECT' });
    expect(resolveSpaceCommercialDistribution({ allySharePercent: 3.75, investorSharePercent: 80, evgreenSharePercent: 20 }, project)).toEqual({ allySharePercent: 3.75, investorSharePercent: 80, evgreenSharePercent: 20, source: 'SPACE' });
  });
  it('no oculta un snapshot JSON corrupto con sugerencias', () => {
    expect(() => resolveSpaceCommercialDistribution({}, { financialProjectionSnapshot: '{invalid' })).toThrow();
  });
  it('el espacio siempre prevalece sobre proyecto y tipo', () => {
    expect(resolveSpaceCommercialDistribution({ spaceType: 'gas_station', allySharePercent: '3.75', investorSharePercent: '0', evgreenSharePercent: '100' }, { hostSharePercent: 10, investorSharePercent: 60, evgreenSharePercent: 40 })).toEqual({ allySharePercent: 3.75, investorSharePercent: 0, evgreenSharePercent: 100, source: 'SPACE' });
  });
  it('no convierte una configuración inválida en default', () => {
    expect(() => resolveSpaceCommercialDistribution({ investorSharePercent: 80, evgreenSharePercent: 40 })).toThrow(/100/);
    expect(() => resolveSpaceCommercialDistribution({ allySharePercent: -1 })).toThrow();
  });
  it.each([{}, { allySharePercent: 0, investorSharePercent: 100, evgreenSharePercent: 0 }, { allySharePercent: 3.75, investorSharePercent: 62.25, evgreenSharePercent: 37.75 }, { allySharePercent: 50, investorSharePercent: 0, evgreenSharePercent: 100 }])('acepta parches completos y bordes %j', patch => expect(validateSpaceDistributionPatch(patch)).toBe(true));
  it.each([{ allySharePercent: 10 }, { investorSharePercent: 60, evgreenSharePercent: 40 }, { allySharePercent: 10, investorSharePercent: 60, evgreenSharePercent: 30 }, { allySharePercent: 50.01, investorSharePercent: 60, evgreenSharePercent: 40 }, { allySharePercent: 3.751, investorSharePercent: 60, evgreenSharePercent: 40 }])('rechaza acuerdos parciales, fuera de rango o imprecisos %j', patch => expect(validateSpaceDistributionPatch(patch)).toBe(false));
  it('serializa como DECIMAL sin perder 0 ni 3,75', () => {
    const split = resolveSpaceCommercialDistribution({ allySharePercent: 3.75, investorSharePercent: 0, evgreenSharePercent: 100 });
    expect(spaceDistributionColumns(split)).toEqual({ allySharePercent: '3.75', investorSharePercent: '0.00', evgreenSharePercent: '100.00' });
  });
  it('los escenarios usan el porcentaje personalizado, no la sugerencia del tipo', () => {
    const projection = buildSpaceTrafficProjection({ ...base, hostSharePercent: 15, investorSharePercent: 80, evgreenSharePercent: 20 });
    expect(projection.assumptions).toMatchObject({ hostSharePercent: 15, investorSharePercent: 80, evgreenSharePercent: 20 });
    for (const scenario of Object.values(projection.scenarios)) {
      expect(scenario.waterfall.hostPayout).toBeCloseTo(scenario.waterfall.grossMargin * 0.15, 2);
      expect(scenario.investorMonthlyCashflow).toBeCloseTo(scenario.waterfall.netDistributableMargin * 0.8, 2);
      expect(scenario.investorAnnualCashflow).toBeCloseTo(scenario.investorMonthlyCashflow * 12, 2);
      expect(scenario.roiAnnualPercent).toBeCloseTo(scenario.investorAnnualCashflow / base.investmentCop * 100, 2);
      expect(scenario.waterfall.hostPayout + scenario.waterfall.investorPool + scenario.waterfall.evgreenPool).toBeCloseTo(scenario.waterfall.grossMargin, 2);
    }
  });
  it('0 aliado y 100 inversionista no provocan fallback', () => {
    const p = buildSpaceTrafficProjection({ ...base, hostSharePercent: 0, investorSharePercent: 100, evgreenSharePercent: 0 });
    expect(p.scenarios.REALISTIC.waterfall.hostPayout).toBe(0);
    expect(p.scenarios.REALISTIC.waterfall.evgreenPool).toBe(0);
    expect(p.scenarios.REALISTIC.investorMonthlyCashflow).toBe(p.scenarios.REALISTIC.waterfall.grossMargin);
  });
  it('solo cambia el reparto, no inventa demanda, capacidad ni energía', () => {
    const standard = buildSpaceTrafficProjection(base);
    const custom = buildSpaceTrafficProjection({ ...base, hostSharePercent: 3.75, investorSharePercent: 82, evgreenSharePercent: 18 });
    expect(custom.scenarios.REALISTIC.energyKwhPerMonth).toBe(standard.scenarios.REALISTIC.energyKwhPerMonth);
    expect(custom.scenarios.OPTIMISTIC.sessionsPerDay).toBe(standard.scenarios.OPTIMISTIC.sessionsPerDay);
    expect(custom.scenarios.REALISTIC.investorMonthlyCashflow).not.toBe(standard.scenarios.REALISTIC.investorMonthlyCashflow);
  });
});
