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
    expect(result.unavailableFields).toContain("generación anual, autoconsumo, exportación, cobertura y costo solar");
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
