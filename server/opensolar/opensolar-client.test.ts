import { afterEach, describe, expect, it, vi } from "vitest";
import { extractOpenSolarUsage, getOpenSolarBearerToken, getOpenSolarProjectPrefill, verifyOpenSolarOrganization } from "./opensolar-client";

describe("diagnóstico OpenSolar", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("intercambia credenciales temporalmente por un Bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ token: "bearer-prueba" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getOpenSolarBearerToken({
      username: "admin@example.com",
      password: "contraseña-temporal",
      mfaToken: "123456",
    });

    expect(result).toMatchObject({ success: true, status: 200, bearerToken: "bearer-prueba" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.opensolar.com/api-token-auth/",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Content-Type": "application/json", Accept: "application/json" }),
        body: JSON.stringify({ username: "admin@example.com", password: "contraseña-temporal", token: "123456" }),
      }),
    );
  });

  it("no llama a OpenSolar sin usuario y contraseña", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(getOpenSolarBearerToken({ username: "", password: "contraseña" })).resolves.toMatchObject({ success: false, status: 0 });
    await expect(getOpenSolarBearerToken({ username: "admin@example.com", password: "" })).resolves.toMatchObject({ success: false, status: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("verifica únicamente la organización configurada con Bearer", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "org-evgreen", name: "EVGreen Solar" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await verifyOpenSolarOrganization({ bearerToken: "token-prueba", orgId: "org-evgreen" });

    expect(result).toMatchObject({ success: true, status: 200, organizationId: "org-evgreen", organizationName: "EVGreen Solar" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.opensolar.com/api/orgs/org-evgreen/",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token-prueba", Accept: "application/json" }),
      }),
    );
  });

  it("no acepta una organización diferente a la configurada", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "other-org", name: "Otra organización" }), { status: 200 })));

    await expect(verifyOpenSolarOrganization({ bearerToken: "token-prueba", orgId: "org-evgreen" })).resolves.toMatchObject({
      success: false,
      status: 200,
      message: "La respuesta de OpenSolar no corresponde al ID de organización configurado.",
    });
  });
});

describe("precarga de proyecto OpenSolar", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("mapea sólo datos técnicos, ubicación y consumo explícitos", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 101,
        org_id: "org-evgreen",
        title: "EDS NQS 41",
        address: "Av. NQS 41",
        locality: "Bogotá",
        state: "Cundinamarca",
        lat: 4.66123,
        lon: -74.07987,
        usage: { usage_data_source: "bill_monthly", values: [1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000, 2100] },
        usage_annual_or_guess: 88000,
        modified_date: "2026-10-12T12:00:00Z",
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        systems: [{ kw_stc: 90.4 }, { kw_stc: "30.1" }],
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getOpenSolarProjectPrefill({
      bearerToken: "token-prueba",
      orgId: "org-evgreen",
      projectId: "101",
    });

    expect(result).toMatchObject({
      success: true,
      project: {
        id: "101",
        title: "EDS NQS 41",
        address: "Av. NQS 41",
        locality: "Bogotá",
        state: "Cundinamarca",
        latitude: 4.66123,
        longitude: -74.07987,
        currentMonthlyBill: 1550,
        annualConsumptionKwh: 88000,
        systemPowerKwp: 120.5,
        systemsCount: 2,
      },
    });
    expect(result.unavailableFields).toContain("generación anual (kWh)");
    expect(result.unavailableFields).toContain("autoconsumo (%)");
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.opensolar.com/api/orgs/org-evgreen/projects/101/",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer token-prueba" }) }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.opensolar.com/api/orgs/org-evgreen/projects/101/systems/details/",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer token-prueba" }) }),
    );
  });

  it("mapea generación, autoconsumo, exportación y métricas derivadas únicamente desde diseño OpenSolar", async () => {
    const { gzipSync } = await import("node:zlib");
    const compressedDesign = gzipSync(Buffer.from(JSON.stringify({
      systems: [{
        kw_stc: 20,
        output: { annual_generation_kwh: 30_000 },
        consumption: { self_consumption_percent: 80, export_percent: 20 },
      }],
    }))).toString("base64");

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 303,
        org_id: "org-evgreen",
        country_iso2: "CO",
        usage: { usage_data_source: "kwh_annual", values: 100_000 },
        usage_annual_or_guess: 100_000,
        design: compressedDesign,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ systems: [{ kw_stc: 20 }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getOpenSolarProjectPrefill({ bearerToken: "token-prueba", orgId: "org-evgreen", projectId: "303" });

    expect(result).toMatchObject({
      success: true,
      project: {
        systemPowerKwp: 20,
        annualGenerationKwh: 30_000,
        selfConsumptionPercent: 80,
        exportPercent: 20,
        energyVsConsumptionPercent: 30,
        solarSavingsCoveragePercent: 24,
        gridTariffCopPerKwh: null,
        canActivateAllySolarProgram: false,
        fieldSources: {
          annualGenerationKwh: "OpenSolar",
          selfConsumptionPercent: "OpenSolar",
          exportPercent: "OpenSolar",
          solarSavingsCoveragePercent: "Calculado desde datos OpenSolar",
        },
      },
    });
    expect(result.unavailableFields).toContain("factura mensual");
    expect(result.unavailableFields).toContain("tarifa de red COP/kWh");
  });

  it("deriva tarifa en COP y habilitabilidad del programa sólo con factura, consumo y cobertura reales", async () => {
    const { gzipSync } = await import("node:zlib");
    const compressedDesign = gzipSync(Buffer.from(JSON.stringify({
      systems: [{
        kw_stc: 10,
        output: { annual_generation_kwh: 24_000 },
        consumption: { self_consumption_percent: 50, export_percent: 50 },
      }],
    }))).toString("base64");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 304,
        org_id: "org-evgreen",
        country_iso2: "CO",
        usage: { usage_data_source: "bill_annual", values: 12_000_000 },
        usage_annual_or_guess: 12_000,
        design: compressedDesign,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ systems: [{ kw_stc: 10 }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getOpenSolarProjectPrefill({ bearerToken: "token-prueba", orgId: "org-evgreen", projectId: "304" });

    expect(result.project).toMatchObject({
      currentMonthlyBill: 1_000_000,
      annualConsumptionKwh: 12_000,
      annualGenerationKwh: 24_000,
      solarSavingsCoveragePercent: 100,
      gridTariffCopPerKwh: 1_000,
      canActivateAllySolarProgram: true,
      fieldSources: {
        gridTariffCopPerKwh: "Calculado desde datos OpenSolar",
      },
    });
  });

  it("mapea de forma integral cada campo permitido cuando la API y el diseño los exponen", async () => {
    const { gzipSync } = await import("node:zlib");
    const compressedDesign = gzipSync(Buffer.from(JSON.stringify({
      systems: [
        { kw_stc: 12, output: { annual_generation_kwh: 21_600 }, consumption: { self_consumption_percent: 75, export_percent: 25 } },
        { kw_stc: 8, output: { annual_generation_kwh: 14_400 } },
      ],
      payment_options: [{
        regular_payment: 2_162_043,
        term: 72,
        term_years: 6,
        utility_bill_yearly_proposed: [1_708_730.57, 2_133_456.01, 2_693_061.42, 3_112_000, 3_456_000, 4_032_000, 5_086_020],
      }],
    }))).toString("base64");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 505,
        org_id: "org-evgreen",
        title: "Proyecto solar EDS Centro",
        address: "Av. 68 # 40-10",
        locality: "Bogotá",
        state: "Cundinamarca",
        lat: 4.64567891,
        lon: -74.08765432,
        country_iso2: "CO",
        modified_date: "2026-10-12T20:00:00Z",
        usage: { usage_data_source: "bill_monthly", values: [1_200_000, 1_200_000, 1_200_000, 1_200_000, 1_200_000, 1_200_000, 1_200_000, 1_200_000, 1_200_000, 1_200_000, 1_200_000, 1_200_000] },
        usage_annual_or_guess: 36_000,
        design: compressedDesign,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ systems: [{ kw_stc: 12 }, { kw_stc: 8 }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getOpenSolarProjectPrefill({ bearerToken: "token-prueba", orgId: "org-evgreen", projectId: "505" });

    expect(result).toEqual({
      success: true,
      status: 200,
      message: "Proyecto OpenSolar consultado. Revisa los datos precargados antes de guardar el espacio.",
      project: {
        id: "505",
        title: "Proyecto solar EDS Centro",
        address: "Av. 68 # 40-10",
        locality: "Bogotá",
        state: "Cundinamarca",
        latitude: 4.64567891,
        longitude: -74.08765432,
        annualConsumptionKwh: 36_000,
        currentMonthlyBill: 1_200_000,
        systemPowerKwp: 20,
        annualGenerationKwh: 36_000,
        selfConsumptionPercent: 75,
        exportPercent: 25,
        energyVsConsumptionPercent: 100,
        solarSavingsCoveragePercent: 88.13,
        gridTariffCopPerKwh: 400,
        monthlyFinancingPaymentCop: 2_162_043,
        initialMonthlySolarBillCop: 142_394.21,
        postAgreementMonthlySolarBillCop: 423_835,
        financingAgreementYears: 6,
        canActivateAllySolarProgram: true,
        systemsCount: 2,
        modifiedAt: "2026-10-12T20:00:00Z",
        fieldSources: {
          annualConsumptionKwh: "OpenSolar",
          currentMonthlyBill: "OpenSolar",
          systemPowerKwp: "OpenSolar",
          annualGenerationKwh: "OpenSolar",
          selfConsumptionPercent: "OpenSolar",
          exportPercent: "OpenSolar",
          energyVsConsumptionPercent: "Calculado desde datos OpenSolar",
          solarSavingsCoveragePercent: "OpenSolar",
          gridTariffCopPerKwh: "Calculado desde datos OpenSolar",
          monthlyFinancingPaymentCop: "OpenSolar",
          initialMonthlySolarBillCop: "OpenSolar",
          postAgreementMonthlySolarBillCop: "OpenSolar",
        },
      },
      unavailableFields: [],
      warnings: [],
    });
  });

  it("mapea la salida calculada, autoconsumo y factura actual de systems/details sin depender de Raw Data", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 11062957,
        org_id: "org-evgreen",
        country_iso2: "CO",
        usage_annual_or_guess: 28_800,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        systems: [{
          kw_stc: 23.8,
          data: {
            output: { annual: 30_147.11 },
            consumption: {
              usage_annual: 28_800,
              self_consumption_percentage_no_battery: 37.77,
              self_consumption_kwh_no_battery: 11_385.305676,
            },
            bills: {
              current: {
                bills_yearly: [{
                  annual: {
                    average_annual_bill_breakdown: { total_inc_tax: 2_249_520 },
                    total: 26_994_240,
                  },
                }],
              },
            },
          },
        }],
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getOpenSolarProjectPrefill({ bearerToken: "token-prueba", orgId: "org-evgreen", projectId: "11062957" });

    expect(result.project).toMatchObject({
      annualConsumptionKwh: 28_800,
      currentMonthlyBill: 2_249_520,
      systemPowerKwp: 23.8,
      annualGenerationKwh: 30_147.11,
      selfConsumptionPercent: 37.77,
      exportPercent: 62.23,
      energyVsConsumptionPercent: 104.68,
      solarSavingsCoveragePercent: 39.54,
      gridTariffCopPerKwh: 937.3,
      canActivateAllySolarProgram: true,
      fieldSources: {
        annualConsumptionKwh: "OpenSolar",
        currentMonthlyBill: "OpenSolar",
        systemPowerKwp: "OpenSolar",
        annualGenerationKwh: "OpenSolar",
        selfConsumptionPercent: "OpenSolar",
        exportPercent: "Calculado desde datos OpenSolar",
        energyVsConsumptionPercent: "Calculado desde datos OpenSolar",
        solarSavingsCoveragePercent: "Calculado desde datos OpenSolar",
        gridTariffCopPerKwh: "Calculado desde datos OpenSolar",
      },
    });
    expect(result.unavailableFields).toEqual(expect.arrayContaining([
      "cuota mensual de financiación",
      "factura solar residual año 1",
      "factura solar residual posterior al plazo",
    ]));
    expect(result.warnings).toEqual([]);
  });

  it("pondera el autoconsumo por generación cuando OpenSolar devuelve varios sistemas", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 606,
        org_id: "org-evgreen",
        usage_annual_or_guess: 100_000,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        systems: [
          { kw_stc: 1, data: { output: { annual: 1_000 }, consumption: { self_consumption_percentage_no_battery: 20 } } },
          { kw_stc: 3, data: { output: { annual: 3_000 }, consumption: { self_consumption_percentage_no_battery: 80 } } },
        ],
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getOpenSolarProjectPrefill({ bearerToken: "token-prueba", orgId: "org-evgreen", projectId: "606" });

    expect(result.project).toMatchObject({
      systemPowerKwp: 4,
      annualGenerationKwh: 4_000,
      selfConsumptionPercent: 65,
      exportPercent: 35,
      energyVsConsumptionPercent: 4,
      solarSavingsCoveragePercent: 2.6,
    });
  });

  it("no consulta sistemas si el proyecto no pertenece a la organización configurada", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 101, org_id: "otra-org" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getOpenSolarProjectPrefill({ bearerToken: "token-prueba", orgId: "org-evgreen", projectId: "101" })).resolves.toMatchObject({
      success: false,
      message: "El proyecto OpenSolar no pertenece a la organización configurada.",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("mantiene los campos de ahorro pendientes cuando el plan no expone detalles de sistema", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 202,
        org_id: "org-evgreen",
        usage: { usage_data_source: "kwh_monthly", values: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100] },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: "not available" }), { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getOpenSolarProjectPrefill({ bearerToken: "token-prueba", orgId: "org-evgreen", projectId: "202" });

    expect(result).toMatchObject({
      success: true,
      project: { annualConsumptionKwh: 1200, currentMonthlyBill: null, systemPowerKwp: null },
    });
    expect(result.unavailableFields).toContain("potencia solar (kWp)");
    expect(result.unavailableFields).toContain("factura mensual");
    expect(result.warnings?.[0]).toMatch(/rechazó el token|permiso de lectura/);
  });

  it("normaliza los formatos de consumo documentados sin inventar valores", () => {
    expect(extractOpenSolarUsage({
      usage: JSON.stringify({ usage_data_source: "kwh_quarterly", values: [100, 200, 300, 400] }),
      usage_annual_or_guess: null,
    })).toEqual({ annualConsumptionKwh: 1000, currentMonthlyBill: null });

    expect(extractOpenSolarUsage({
      usage: { usage_data_source: "bill_every_second_month", values: [100, 200, 300, 400, 500, 600] },
      usage_annual_or_guess: null,
    })).toEqual({ annualConsumptionKwh: null, currentMonthlyBill: 175 });
  });
});
