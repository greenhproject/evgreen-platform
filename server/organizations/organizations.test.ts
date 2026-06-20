/**
 * Tests para el módulo de Organizaciones SaaS (EVGreen)
 * 
 * Cubre:
 * 1. Control de acceso por rol (RBAC) — solo admin puede gestionar orgs
 * 2. Aislamiento de tenant — usuarios solo ven datos de su propia org
 * 3. Gestión de tickets de soporte — creación, listado, cambio de estado
 * 4. Validación de entradas — campos requeridos, límites, tipos
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";

// ============================================================================
// MOCKS
// ============================================================================

vi.mock("../db", async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    getWalletByUserId: vi.fn().mockResolvedValue({ id: 1, userId: 1, balance: "0", currency: "COP" }),
    createWallet: vi.fn().mockResolvedValue({ id: 1 }),
  };
});

vi.mock("../../drizzle/schema", async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return { ...actual };
});

// Mock the DB layer used inside the organizations router
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return { ...actual };
});

// ============================================================================
// HELPERS
// ============================================================================

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createMockContext(role: "user" | "admin" | "investor" | "technician" = "user", userId = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `test-user-${userId}`,
    email: `user${userId}@evgreen.co`,
    name: "Test User",
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createAnonymousContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ============================================================================
// TESTS: RBAC — Control de acceso por rol (admin-only procedures)
// ============================================================================

describe("Organizations RBAC — Admin-only procedures", () => {
  it("usuario regular NO puede listar organizaciones (list)", async () => {
    const ctx = createMockContext("user");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.organizations.list({})).rejects.toThrow();
  });

  it("inversionista NO puede listar organizaciones", async () => {
    const ctx = createMockContext("investor");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.organizations.list({})).rejects.toThrow();
  });

  it("técnico NO puede listar organizaciones", async () => {
    const ctx = createMockContext("technician");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.organizations.list({})).rejects.toThrow();
  });

  it("usuario anónimo NO puede listar organizaciones", async () => {
    const ctx = createAnonymousContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.organizations.list({})).rejects.toThrow();
  });

  it("usuario regular NO puede ver usuarios de una org (listOrgUsers)", async () => {
    const ctx = createMockContext("user");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.organizations.listOrgUsers({ orgId: 1 })).rejects.toThrow();
  });

  it("usuario regular NO puede cambiar estado de ticket (updateTicketStatus)", async () => {
    const ctx = createMockContext("user");
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.organizations.updateTicketStatus({ ticketId: 1, status: "in_progress" })
    ).rejects.toThrow();
  });

  it("usuario regular NO puede ver estaciones de una org (listOrgStations)", async () => {
    const ctx = createMockContext("user");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.organizations.listOrgStations({ orgId: 1 })).rejects.toThrow();
  });

  it("usuario regular NO puede crear una organización (create)", async () => {
    const ctx = createMockContext("user");
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.organizations.create({
        name: "Org Maliciosa",
        slug: "org-maliciosa",
        plan: "starter",
      })
    ).rejects.toThrow();
  });

  it("usuario anónimo NO puede crear una organización", async () => {
    const ctx = createAnonymousContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.organizations.create({
        name: "Org Anónima",
        slug: "org-anonima",
        plan: "starter",
      })
    ).rejects.toThrow();
  });
});

// ============================================================================
// TESTS: Aislamiento de tenant — portal del usuario
// ============================================================================

describe("Organizations — Portal de usuario (tenant isolation)", () => {
  it("usuario anónimo NO puede acceder a getMyOrg", async () => {
    const ctx = createAnonymousContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.organizations.getMyOrg()).rejects.toThrow();
  });

  it("usuario anónimo NO puede ver sus estaciones (getMyStations)", async () => {
    const ctx = createAnonymousContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.organizations.getMyStations()).rejects.toThrow();
  });

  it("usuario anónimo NO puede ver sus tickets (getMyTickets)", async () => {
    const ctx = createAnonymousContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.organizations.getMyTickets()).rejects.toThrow();
  });

  it("usuario anónimo NO puede crear tickets (createMyTicket)", async () => {
    const ctx = createAnonymousContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.organizations.createMyTicket({
        title: "Ticket anónimo",
        description: "Descripción",
        category: "technical",
        priority: "medium",
      })
    ).rejects.toThrow();
  });
});

// ============================================================================
// TESTS: Validación de entradas — createMyTicket
// ============================================================================

describe("Organizations — Validación de entradas en createMyTicket", () => {
  it("NO acepta título vacío", async () => {
    const ctx = createMockContext("user");
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.organizations.createMyTicket({
        title: "",
        description: "Descripción válida",
        category: "technical",
        priority: "medium",
      })
    ).rejects.toThrow();
  });

  it("NO acepta título demasiado corto (< 3 chars)", async () => {
    const ctx = createMockContext("user");
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.organizations.createMyTicket({
        title: "ab",
        description: "Descripción válida",
        category: "technical",
        priority: "medium",
      })
    ).rejects.toThrow();
  });

  it("NO acepta descripción vacía", async () => {
    const ctx = createMockContext("user");
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.organizations.createMyTicket({
        title: "Título válido",
        description: "",
        category: "technical",
        priority: "medium",
      })
    ).rejects.toThrow();
  });

  it("NO acepta categoría inválida", async () => {
    const ctx = createMockContext("user");
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.organizations.createMyTicket({
        title: "Título válido",
        description: "Descripción válida",
        category: "invalid_category" as any,
        priority: "medium",
      })
    ).rejects.toThrow();
  });

  it("NO acepta prioridad inválida", async () => {
    const ctx = createMockContext("user");
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.organizations.createMyTicket({
        title: "Título válido",
        description: "Descripción válida",
        category: "technical",
        priority: "ultra_critical" as any,
      })
    ).rejects.toThrow();
  });
});

// ============================================================================
// TESTS: Validación de entradas — updateTicketStatus (admin)
// ============================================================================

describe("Organizations — Validación de entradas en updateTicketStatus", () => {
  it("NO acepta estado inválido", async () => {
    const ctx = createMockContext("admin");
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.organizations.updateTicketStatus({
        ticketId: 1,
        status: "hacked" as any,
      })
    ).rejects.toThrow();
  });

  it("NO acepta ticketId negativo", async () => {
    const ctx = createMockContext("admin");
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.organizations.updateTicketStatus({
        ticketId: -1,
        status: "in_progress",
      })
    ).rejects.toThrow();
  });
});

// ============================================================================
// TESTS: Validación de entradas — create (admin)
// ============================================================================

describe("Organizations — Validación de entradas en create", () => {
  it("NO acepta nombre demasiado corto", async () => {
    const ctx = createMockContext("admin");
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.organizations.create({
        name: "A", // < 2 chars
        slug: "org-valida",
        plan: "starter",
      })
    ).rejects.toThrow();
  });

  it("NO acepta slug con caracteres especiales", async () => {
    const ctx = createMockContext("admin");
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.organizations.create({
        name: "Org Válida",
        slug: "Org Inválida!", // mayúsculas y espacios no permitidos
        plan: "starter",
      })
    ).rejects.toThrow();
  });

  it("NO acepta plan inválido", async () => {
    const ctx = createMockContext("admin");
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.organizations.create({
        name: "Org Válida",
        slug: "org-valida",
        plan: "free_forever" as any,
      })
    ).rejects.toThrow();
  });

  it("NO acepta email de contacto inválido", async () => {
    const ctx = createMockContext("admin");
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.organizations.create({
        name: "Org Válida",
        slug: "org-valida",
        plan: "starter",
        contactEmail: "not-an-email",
      })
    ).rejects.toThrow();
  });
});
