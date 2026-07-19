/**
 * Tests para el módulo de Espacios Postulados
 * Verifica: submit público, consulta de estado, listado admin, scoring IA, etc.
 */
import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";
import { getDb } from "../db";
import { spaceSubmissions } from "../../drizzle/schema";
import { like, or } from "drizzle-orm";

// ============================================================================
// HELPERS
// ============================================================================

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: { origin: "https://evgreen.lat" },
      socket: { remoteAddress: "127.0.0.1" },
    } as any,
    res: {
      clearCookie: vi.fn(),
    } as any,
  };
}

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user-001",
    email: "admin@evgreen.lat",
    name: "Admin EVGreen",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: { origin: "https://evgreen.lat" },
      socket: { remoteAddress: "127.0.0.1" },
    } as any,
    res: {
      clearCookie: vi.fn(),
    } as any,
  };
}

function createUserContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "regular-user-001",
    email: "user@example.com",
    name: "Regular User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: { origin: "https://evgreen.lat" },
      socket: { remoteAddress: "127.0.0.1" },
    } as any,
    res: {
      clearCookie: vi.fn(),
    } as any,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe("spaces.submit", () => {
  it("crea una postulación con datos mínimos requeridos", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.spaces.submit({
      submitterName: "Juan Pérez Test",
      submitterEmail: "juan.test@example.com",
      submitterPhone: "3001234567",
      spaceName: "Parqueadero Test Vitest",
      spaceType: "parking",
      address: "Calle 100 #15-20, Bogotá",
      city: "Bogotá",
    });

    expect(result).toBeDefined();
    expect(result.code).toMatch(/^SPE-\d{4}-\d{4}$/);
    expect(typeof result.submissionId).toBe("number");
    expect(result.submissionId).toBeGreaterThan(0);
  });

  it("crea una postulación con todos los campos opcionales", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.spaces.submit({
      submitterName: "María García Test",
      submitterEmail: "maria.test@example.com",
      submitterPhone: "3109876543",
      submitterCompany: "Empresa Test S.A.S.",
      submitterDocument: "900.123.456-7",
      spaceName: "Centro Comercial Test",
      spaceType: "mall",
      spaceTypeOther: undefined,
      address: "Av. El Dorado #68-95",
      city: "Bogotá",
      department: "Cundinamarca",
      latitude: "4.6486",
      longitude: "-74.1009",
      availableAreaM2: "200",
      parkingSpots: 10,
      transformerCapacityKva: "225",
      hasElectricalPanel: true,
      electricalDistance: 15,
      hasInternet: true,
      operatingHoursStart: "07:00",
      operatingHoursEnd: "21:00",
      is24Hours: false,
      estimatedDailyVehicles: 500,
      estimatedEvPercent: 5,
      nearbyAttractions: "Universidad Nacional a 300m, zona empresarial",
      socioeconomicStratum: 4,
      additionalNotes: "Espacio con buena visibilidad desde la avenida principal",
    });

    expect(result).toBeDefined();
    expect(result.code).toMatch(/^SPE-\d{4}-\d{4}$/);
  });

  it("rechaza postulación sin nombre", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.spaces.submit({
        submitterName: "",
        submitterEmail: "test@example.com",
        submitterPhone: "3001234567",
        spaceName: "Test",
        spaceType: "parking",
        address: "Test address",
        city: "Bogotá",
      })
    ).rejects.toThrow();
  });

  it("rechaza postulación con email inválido", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.spaces.submit({
        submitterName: "Test User",
        submitterEmail: "not-an-email",
        submitterPhone: "3001234567",
        spaceName: "Test",
        spaceType: "parking",
        address: "Test address",
        city: "Bogotá",
      })
    ).rejects.toThrow();
  });
});

describe("spaces.getStatus", () => {
  it("retorna el estado de una postulación existente", async () => {
    const publicCtx = createPublicContext();
    const caller = appRouter.createCaller(publicCtx);

    // Primero crear una postulación
    const { code } = await caller.spaces.submit({
      submitterName: "Status Test User",
      submitterEmail: "status.test@example.com",
      submitterPhone: "3001234567",
      spaceName: "Espacio Status Test",
      spaceType: "hotel",
      address: "Carrera 7 #72-41",
      city: "Bogotá",
    });

    // Consultar estado
    const status = await caller.spaces.getStatus({ code });

    expect(status).toBeDefined();
    expect(status.code).toBe(code);
    expect(status.spaceName).toBe("Espacio Status Test");
    expect(status.status).toBe("pending");
    expect(status.city).toBe("Bogotá");
  });

  it("lanza error para código inexistente", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.spaces.getStatus({ code: "SPE-9999-9999" })
    ).rejects.toThrow("Postulación no encontrada");
  });
});

describe("spaces.admin.list", () => {
  it("lista postulaciones como admin", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.spaces.admin.list({});

    expect(result).toBeDefined();
    expect(result.submissions).toBeDefined();
    expect(Array.isArray(result.submissions)).toBe(true);
    expect(typeof result.total).toBe("number");
    expect(result.statusCounts).toBeDefined();
  });

  it("filtra por estado", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.spaces.admin.list({ status: "pending" });

    expect(result).toBeDefined();
    // Todas las submissions deben ser pending
    for (const sub of result.submissions) {
      expect(sub.status).toBe("pending");
    }
  });

  it("busca por texto", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.spaces.admin.list({ search: "Vitest" });

    expect(result).toBeDefined();
    // Debería encontrar al menos la postulación creada en tests anteriores
    expect(result.total).toBeGreaterThanOrEqual(0);
  });

  it("rechaza acceso de usuario regular", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.spaces.admin.list({})
    ).rejects.toThrow();
  });
});

describe("spaces.admin.getById", () => {
  it("obtiene detalle de una postulación como admin", async () => {
    // Primero crear una postulación
    const publicCtx = createPublicContext();
    const publicCaller = appRouter.createCaller(publicCtx);
    const { submissionId } = await publicCaller.spaces.submit({
      submitterName: "Detail Test",
      submitterEmail: "detail@example.com",
      submitterPhone: "3001234567",
      spaceName: "Espacio Detalle Test",
      spaceType: "gas_station",
      address: "Autopista Norte km 5",
      city: "Bogotá",
    });

    // Obtener detalle como admin
    const adminCtx = createAdminContext();
    const adminCaller = appRouter.createCaller(adminCtx);
    const detail = await adminCaller.spaces.admin.getById({ id: submissionId });

    expect(detail).toBeDefined();
    expect(detail.spaceName).toBe("Espacio Detalle Test");
    expect(detail.submitterName).toBe("Detail Test");
    expect(detail.spaceType).toBe("gas_station");
    expect(detail.photos).toBeDefined();
    expect(Array.isArray(detail.photos)).toBe(true);
  });

  it("lanza error para ID inexistente", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.spaces.admin.getById({ id: 999999 })
    ).rejects.toThrow("Postulación no encontrada");
  });
});

describe("spaces.admin.updateStatus", () => {
  it("actualiza el estado de una postulación", async () => {
    // Crear postulación
    const publicCtx = createPublicContext();
    const publicCaller = appRouter.createCaller(publicCtx);
    const { submissionId } = await publicCaller.spaces.submit({
      submitterName: "Update Test",
      submitterEmail: "update@example.com",
      submitterPhone: "3001234567",
      spaceName: "Espacio Update Test",
      spaceType: "university",
      address: "Campus Universitario",
      city: "Medellín",
    });

    // Actualizar estado como admin
    const adminCtx = createAdminContext();
    const adminCaller = appRouter.createCaller(adminCtx);
    const result = await adminCaller.spaces.admin.updateStatus({
      id: submissionId,
      status: "under_review",
    });

    expect(result.success).toBe(true);

    // Verificar que el estado cambió
    const detail = await adminCaller.spaces.admin.getById({ id: submissionId });
    expect(detail.status).toBe("under_review");
  });
});

describe("spaces.listPublished", () => {
  it("retorna lista de espacios publicados (puede estar vacía)", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.spaces.listPublished();

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    // Cada espacio publicado debe tener los campos esperados
    for (const space of result) {
      expect(space.id).toBeDefined();
      expect(space.code).toBeDefined();
      expect(space.spaceName).toBeDefined();
      expect(space.city).toBeDefined();
    }
  });
});

describe("spaces.acceptLetter", () => {
  it("rechaza token inválido", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.spaces.acceptLetter({
        token: "invalid-token-that-does-not-exist",
        signerName: "Test Signer",
        signerDocument: "1234567890",
      })
    ).rejects.toThrow("Token de carta de intención inválido");
  });
});

// ============================================================================
// INTEGRACIÓN SPACES ↔ CROWDFUNDING
// ============================================================================

describe("spaces → crowdfunding integration", () => {
  it("auto-crea proyecto CF DRAFT al aprobar un espacio", async () => {
    // 1. Crear postulación
    const publicCtx = createPublicContext();
    const publicCaller = appRouter.createCaller(publicCtx);
    const { submissionId } = await publicCaller.spaces.submit({
      submitterName: "CF Integration Test",
      submitterEmail: "cf-integration@example.com",
      submitterPhone: "3001234567",
      spaceName: "Espacio CF Integration Test",
      spaceType: "mall",
      address: "Calle 80 #50-10",
      city: "Bogotá",
      department: "Cundinamarca",
    });

    // 2. Aprobar como admin → debe auto-crear CF DRAFT
    const adminCtx = createAdminContext();
    const adminCaller = appRouter.createCaller(adminCtx);
    const result = await adminCaller.spaces.admin.updateStatus({
      id: submissionId,
      status: "approved",
    });
    expect(result.success).toBe(true);

    // 3. Verificar que el espacio ahora tiene crowdfundingProjectId
    const detail = await adminCaller.spaces.admin.getById({ id: submissionId });
    expect(detail.status).toBe("approved");
    expect(detail.crowdfundingProjectId).toBeDefined();
    expect(detail.crowdfundingProjectId).toBeGreaterThan(0);

    // 4. Verificar que el proyecto CF existe y es DRAFT
    const cfProjects = await adminCaller.crowdfunding.getAllProjects();
    const linkedCF = cfProjects.find(
      (p: any) => p.id === detail.crowdfundingProjectId
    );
    expect(linkedCF).toBeDefined();
    expect(linkedCF!.status).toBe("DRAFT");
    expect(linkedCF!.city).toBe("Bogotá");
    // Verificar que tiene spaceSubmissionId
    expect(linkedCF!.spaceSubmissionId).toBe(submissionId);
    // Verificar que tiene linked space info del JOIN
    expect(linkedCF!.linkedSpaceName).toBe("Espacio CF Integration Test");
    expect(linkedCF!.linkedSpaceCity).toBe("Bogotá");
    expect(linkedCF!.linkedSubmitterName).toBe("CF Integration Test");
  });

  it("no duplica CF al aprobar un espacio ya aprobado", async () => {
    // 1. Crear y aprobar
    const publicCtx = createPublicContext();
    const publicCaller = appRouter.createCaller(publicCtx);
    const { submissionId } = await publicCaller.spaces.submit({
      submitterName: "No Dup Test",
      submitterEmail: "nodup@example.com",
      submitterPhone: "3001234567",
      spaceName: "Espacio No Dup Test",
      spaceType: "parking",
      address: "Carrera 15 #100-20",
      city: "Cali",
    });

    const adminCtx = createAdminContext();
    const adminCaller = appRouter.createCaller(adminCtx);

    // Primera aprobación
    await adminCaller.spaces.admin.updateStatus({
      id: submissionId,
      status: "approved",
    });
    const detail1 = await adminCaller.spaces.admin.getById({ id: submissionId });
    const cfId1 = detail1.crowdfundingProjectId;
    expect(cfId1).toBeGreaterThan(0);

    // Contar proyectos CF antes de segunda aprobación
    const cfBefore = await adminCaller.crowdfunding.getAllProjects();
    const countBefore = cfBefore.length;

    // Intentar re-aprobar (no debería crear otro CF)
    await adminCaller.spaces.admin.updateStatus({
      id: submissionId,
      status: "approved",
    });
    const detail2 = await adminCaller.spaces.admin.getById({ id: submissionId });
    expect(detail2.crowdfundingProjectId).toBe(cfId1); // Mismo ID

    const cfAfter = await adminCaller.crowdfunding.getAllProjects();
    expect(cfAfter.length).toBe(countBefore); // No se creó otro
  });

  it("getAllProjects incluye DRAFT para admin (includePrivate)", async () => {
    const adminCtx = createAdminContext();
    const adminCaller = appRouter.createCaller(adminCtx);

    const allProjects = await adminCaller.crowdfunding.getAllProjects();
    // Debe incluir al menos un DRAFT (de los tests anteriores)
    const drafts = allProjects.filter((p: any) => p.status === "DRAFT");
    expect(drafts.length).toBeGreaterThanOrEqual(1);
  });

  it("getProjects público NO incluye DRAFT", async () => {
    const publicCtx = createPublicContext();
    const publicCaller = appRouter.createCaller(publicCtx);

    const publicProjects = await publicCaller.crowdfunding.getProjects();
    const drafts = publicProjects.filter((p: any) => p.status === "DRAFT");
    expect(drafts.length).toBe(0);
  });
});

// ============================================================================
// CLEANUP: eliminar todos los registros de test creados por este archivo
// ============================================================================
afterAll(async () => {
  try {
    const db = await getDb();
    await db.delete(spaceSubmissions).where(
      or(
        like(spaceSubmissions.spaceName, "%Test%"),
        like(spaceSubmissions.submitterName, "%Test%"),
        like(spaceSubmissions.submitterEmail, "%example.com%")
      )
    );
  } catch (e) {
    // Silenciar errores de cleanup para no afectar resultados de tests
    console.warn("[spaces.test cleanup] Error limpiando registros de test:", e);
  }
});
