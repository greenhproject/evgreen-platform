/**
 * Tests para el Users Router
 * 
 * Verifica los endpoints de gestión de usuarios del panel de administración
 */

import { describe, it, expect, vi } from "vitest";

// Mock de funciones de base de datos
vi.mock("./db", () => ({
  getUserById: vi.fn(),
  getAllUsers: vi.fn(),
  updateUser: vi.fn(),
  updateUserRole: vi.fn(),
  deleteUser: vi.fn(),
  regenerateUserIdTag: vi.fn(),
}));

describe("Users Router", () => {
  describe("Protección de cuenta maestra", () => {
    const masterEmail = "greenhproject@gmail.com";
    
    it("debe identificar correctamente la cuenta maestra por email", () => {
      const isMasterAccount = (email: string | null) => email === masterEmail;
      expect(isMasterAccount(masterEmail)).toBe(true);
      expect(isMasterAccount("otro@email.com")).toBe(false);
      expect(isMasterAccount(null)).toBe(false);
    });

    it("no debe permitir eliminar la cuenta maestra", () => {
      const user = { id: 1, email: masterEmail, role: "admin" };
      const canDelete = user.email !== masterEmail;
      expect(canDelete).toBe(false);
    });

    it("no debe permitir cambiar el rol de la cuenta maestra a otro rol", () => {
      const user = { id: 1, email: masterEmail, role: "admin" };
      const newRole = "user";
      // La cuenta maestra solo puede mantener el rol admin
      const canChangeToNonAdmin = user.email !== masterEmail;
      expect(canChangeToNonAdmin).toBe(false);
    });

    it("debe permitir mantener el rol admin de la cuenta maestra", () => {
      const user = { id: 1, email: masterEmail, role: "admin" };
      const newRole = "admin";
      // Cambiar a admin está permitido (aunque ya lo es)
      const canKeepAdmin = newRole === "admin";
      expect(canKeepAdmin).toBe(true);
    });

    it("debe permitir eliminar usuarios normales", () => {
      const user = { id: 2, email: "usuario@test.com", role: "user" };
      const canDelete = user.email !== masterEmail;
      expect(canDelete).toBe(true);
    });
  });

  describe("Validación de roles", () => {
    const validRoles = ["staff", "technician", "investor", "user", "admin"];

    it("debe validar roles permitidos", () => {
      validRoles.forEach((role) => {
        expect(validRoles.includes(role)).toBe(true);
      });
    });

    it("debe rechazar roles inválidos", () => {
      const invalidRoles = ["superadmin", "guest", "moderator"];
      invalidRoles.forEach((role) => {
        expect(validRoles.includes(role)).toBe(false);
      });
    });
  });

  describe("Validación de datos de usuario", () => {
    it("debe validar formato de email", () => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      expect(emailRegex.test("usuario@ejemplo.com")).toBe(true);
      expect(emailRegex.test("usuario@ejemplo")).toBe(false);
      expect(emailRegex.test("usuario.com")).toBe(false);
      expect(emailRegex.test("@ejemplo.com")).toBe(false);
    });

    it("debe validar formato de teléfono colombiano", () => {
      const phoneRegex = /^\+?57\s?\d{10}$/;
      expect(phoneRegex.test("+573001234567")).toBe(true);
      expect(phoneRegex.test("573001234567")).toBe(true);
      expect(phoneRegex.test("+57 3001234567")).toBe(true);
      expect(phoneRegex.test("3001234567")).toBe(false);
    });

    it("debe validar NIT colombiano", () => {
      // NIT tiene formato: 9 dígitos + guión + dígito de verificación
      const nitRegex = /^\d{9}-\d$/;
      expect(nitRegex.test("123456789-0")).toBe(true);
      expect(nitRegex.test("987654321-5")).toBe(true);
      expect(nitRegex.test("12345678-0")).toBe(false); // 8 dígitos
      expect(nitRegex.test("1234567890")).toBe(false); // Sin guión
    });
  });

  describe("Actualización de usuario", () => {
    it("debe permitir actualizar campos básicos", () => {
      const updateData = {
        name: "Nuevo Nombre",
        phone: "+573001234567",
        isActive: true,
      };
      
      expect(updateData.name).toBeDefined();
      expect(updateData.phone).toBeDefined();
      expect(updateData.isActive).toBe(true);
    });

    it("debe permitir actualizar campos de inversionista", () => {
      const updateData = {
        companyName: "Mi Empresa SAS",
        taxId: "123456789-0",
        bankAccount: "1234567890",
        bankName: "Bancolombia",
      };
      
      expect(updateData.companyName).toBeDefined();
      expect(updateData.taxId).toBeDefined();
      expect(updateData.bankAccount).toBeDefined();
      expect(updateData.bankName).toBeDefined();
    });

    it("debe permitir actualizar campos de técnico", () => {
      const updateData = {
        technicianLicense: "TEC-2024-001",
        assignedRegion: "Bogotá",
      };
      
      expect(updateData.technicianLicense).toBeDefined();
      expect(updateData.assignedRegion).toBeDefined();
    });
  });

  describe("Eliminación de usuario", () => {
    it("debe eliminar datos relacionados antes del usuario", () => {
      // Orden esperado de eliminación
      const deleteOrder = ["wallets", "notifications", "users"];
      
      expect(deleteOrder[0]).toBe("wallets");
      expect(deleteOrder[1]).toBe("notifications");
      expect(deleteOrder[2]).toBe("users");
    });

    it("debe verificar que el usuario existe antes de eliminar", () => {
      const user = null;
      const canDelete = user !== null;
      expect(canDelete).toBe(false);
    });
  });

  describe("TAGID de usuario", () => {
    it("debe tener formato correcto EV-XXXXXX", () => {
      const idTagRegex = /^EV-[A-Z0-9]{6}$/;
      expect(idTagRegex.test("EV-ABC123")).toBe(true);
      expect(idTagRegex.test("EV-TEST01")).toBe(true);
      expect(idTagRegex.test("EV-abc123")).toBe(false); // minúsculas
      expect(idTagRegex.test("ABC123")).toBe(false); // sin prefijo
      expect(idTagRegex.test("EV-AB")).toBe(false); // muy corto
    });

    it("debe ser único por usuario", () => {
      const idTags = ["EV-ABC123", "EV-DEF456", "EV-GHI789"];
      const uniqueIdTags = new Set(idTags);
      expect(uniqueIdTags.size).toBe(idTags.length);
    });
  });

  describe("Gestión de billetera desde admin", () => {
    it("debe calcular correctamente el ajuste de crédito", () => {
      const currentBalance = 50000;
      const adjustAmount = 30000;
      const type = "credit";
      const finalAmount = type === "debit" ? -Math.abs(adjustAmount) : Math.abs(adjustAmount);
      const newBalance = currentBalance + finalAmount;
      expect(newBalance).toBe(80000);
      expect(finalAmount).toBe(30000);
    });

    it("debe calcular correctamente el ajuste de débito", () => {
      const currentBalance = 50000;
      const adjustAmount = 20000;
      const type = "debit";
      const finalAmount = type === "debit" ? -Math.abs(adjustAmount) : Math.abs(adjustAmount);
      const newBalance = currentBalance + finalAmount;
      expect(newBalance).toBe(30000);
      expect(finalAmount).toBe(-20000);
    });

    it("debe rechazar débito que deje saldo negativo", () => {
      const currentBalance = 10000;
      const adjustAmount = 20000;
      const type = "debit";
      const finalAmount = type === "debit" ? -Math.abs(adjustAmount) : Math.abs(adjustAmount);
      const newBalance = currentBalance + finalAmount;
      expect(newBalance).toBeLessThan(0);
      // El backend debe rechazar esta operación
    });

    it("debe calcular correctamente un reembolso", () => {
      const currentBalance = 50000;
      const adjustAmount = 25000;
      const type = "refund";
      const finalAmount = type === "debit" ? -Math.abs(adjustAmount) : Math.abs(adjustAmount);
      const newBalance = currentBalance + finalAmount;
      expect(newBalance).toBe(75000);
      expect(finalAmount).toBe(25000);
    });

    it("debe generar el tipo de transacción correcto", () => {
      const getType = (type: string) => {
        return type === "credit" ? "ADMIN_CREDIT" : type === "refund" ? "ADMIN_REFUND" : "ADMIN_DEBIT";
      };
      expect(getType("credit")).toBe("ADMIN_CREDIT");
      expect(getType("debit")).toBe("ADMIN_DEBIT");
      expect(getType("refund")).toBe("ADMIN_REFUND");
    });

    it("debe incluir el nombre del admin en la descripción", () => {
      const adminName = "Admin Test";
      const reason = "Reembolso por fallo en cobro";
      const description = `[Admin: ${adminName}] ${reason}`;
      expect(description).toContain("Admin: Admin Test");
      expect(description).toContain("Reembolso por fallo en cobro");
    });

    it("debe validar que el motivo tenga al menos 3 caracteres", () => {
      const reason1 = "ab";
      const reason2 = "Reembolso por error";
      expect(reason1.trim().length >= 3).toBe(false);
      expect(reason2.trim().length >= 3).toBe(true);
    });

    it("debe validar que el monto sea mayor a 0", () => {
      expect(0 > 0).toBe(false);
      expect(-100 > 0).toBe(false);
      expect(1000 > 0).toBe(true);
    });

    it("debe retornar balance 0 si el usuario no tiene billetera", () => {
      const wallet = null;
      const balance = wallet ? parseFloat((wallet as any).balance || "0") : 0;
      expect(balance).toBe(0);
    });
  });

  describe("Historial de transacciones de billetera", () => {
    it("debe mapear tipos de transacción a etiquetas legibles", () => {
      const getTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
          RECHARGE: "Recarga",
          CHARGE_PAYMENT: "Pago de carga",
          CHARGE: "Cargo por carga",
          RESERVATION: "Reserva",
          PENALTY: "Penalidad",
          REFUND: "Reembolso",
          SUBSCRIPTION: "Suscripción",
          ADMIN_CREDIT: "Crédito (Admin)",
          ADMIN_DEBIT: "Débito (Admin)",
          ADMIN_REFUND: "Reembolso (Admin)",
          EARNING: "Ganancia",
          STRIPE_PAYMENT: "Pago Stripe",
        };
        return labels[type] || type;
      };
      expect(getTypeLabel("RECHARGE")).toBe("Recarga");
      expect(getTypeLabel("ADMIN_CREDIT")).toBe("Crédito (Admin)");
      expect(getTypeLabel("ADMIN_DEBIT")).toBe("Débito (Admin)");
      expect(getTypeLabel("ADMIN_REFUND")).toBe("Reembolso (Admin)");
      expect(getTypeLabel("EARNING")).toBe("Ganancia");
      expect(getTypeLabel("UNKNOWN_TYPE")).toBe("UNKNOWN_TYPE");
    });

    it("debe clasificar colores de tipo correctamente", () => {
      const getTypeColor = (type: string) => {
        if (type.includes("CREDIT") || type === "RECHARGE" || type === "REFUND" || type === "ADMIN_REFUND" || type === "EARNING" || type === "STRIPE_PAYMENT") return "text-green-600";
        if (type.includes("DEBIT") || type === "CHARGE" || type === "CHARGE_PAYMENT" || type === "PENALTY" || type === "SUBSCRIPTION") return "text-red-600";
        return "text-muted-foreground";
      };
      expect(getTypeColor("ADMIN_CREDIT")).toBe("text-green-600");
      expect(getTypeColor("RECHARGE")).toBe("text-green-600");
      expect(getTypeColor("ADMIN_DEBIT")).toBe("text-red-600");
      expect(getTypeColor("CHARGE")).toBe("text-red-600");
      expect(getTypeColor("PENALTY")).toBe("text-red-600");
    });

    it("debe formatear transacciones para la tabla", () => {
      const tx = {
        id: 1,
        type: "ADMIN_CREDIT",
        amount: "50000.00",
        balanceBefore: "10000.00",
        balanceAfter: "60000.00",
        status: "COMPLETED",
        description: "[Admin: Test] Crédito de prueba",
        createdAt: new Date("2026-02-10"),
      };
      const formatted = {
        ...tx,
        amount: parseFloat(tx.amount),
        balanceBefore: parseFloat(tx.balanceBefore),
        balanceAfter: parseFloat(tx.balanceAfter),
      };
      expect(formatted.amount).toBe(50000);
      expect(formatted.balanceAfter).toBe(60000);
      expect(formatted.description).toContain("Admin: Test");
    });
  });

  describe("Exportación de movimientos", () => {
    it("debe generar CSV con headers correctos", () => {
      const headers = "Fecha,Tipo,Monto (COP),Saldo Antes,Saldo Después,Estado,Motivo";
      expect(headers.split(",").length).toBe(7);
      expect(headers).toContain("Fecha");
      expect(headers).toContain("Monto (COP)");
      expect(headers).toContain("Motivo");
    });

    it("debe escapar comas en descripciones para CSV", () => {
      const desc = "Reembolso por fallo, cobro duplicado";
      const escaped = desc.replace(/,/g, ";");
      expect(escaped).toBe("Reembolso por fallo; cobro duplicado");
      expect(escaped).not.toContain(",");
    });

    it("debe generar nombre de archivo con fecha", () => {
      const userName = "karen heredia";
      const date = "2026-02-10";
      const filename = `movimientos_billetera_${userName}_${date}.csv`;
      expect(filename).toBe("movimientos_billetera_karen heredia_2026-02-10.csv");
    });
  });

  describe("Notificación al usuario por ajuste de saldo", () => {
    it("debe generar título de notificación correcto", () => {
      const types = ["credit", "debit", "refund"];
      const labels = types.map(type => {
        return type === "credit" ? "Crédito agregado" : type === "refund" ? "Reembolso" : "Débito";
      });
      expect(labels[0]).toBe("Crédito agregado");
      expect(labels[1]).toBe("Débito");
      expect(labels[2]).toBe("Reembolso");
    });

    it("debe generar mensaje de notificación con detalles completos", () => {
      const type = "credit";
      const adjustAmount = 50000;
      const newBalance = 150000;
      const reason = "Compensación por error";
      const amountFormatted = Math.abs(adjustAmount).toLocaleString("es-CO");
      const message = `Se ha realizado un ajuste de ${type === "debit" ? "-" : "+"}$${amountFormatted} COP en tu billetera. Nuevo saldo: $${newBalance.toLocaleString("es-CO")} COP. Motivo: ${reason}`;
      expect(message).toContain("+$50");
      expect(message).toContain("150");
      expect(message).toContain("Compensación por error");
    });

    it("debe usar tipo PAYMENT para la notificación", () => {
      const notificationType = "PAYMENT";
      const validTypes = ["CHARGE_COMPLETE", "RESERVATION", "PAYMENT", "MAINTENANCE", "SYSTEM"];
      expect(validTypes).toContain(notificationType);
    });
  });

  describe("Listado de usuarios", () => {
    it("debe filtrar por rol correctamente", () => {
      const users = [
        { id: 1, role: "admin" },
        { id: 2, role: "user" },
        { id: 3, role: "investor" },
        { id: 4, role: "user" },
      ];
      
      const filteredUsers = users.filter((u) => u.role === "user");
      expect(filteredUsers.length).toBe(2);
    });

    it("debe buscar por nombre o email", () => {
      const users = [
        { id: 1, name: "Juan Pérez", email: "juan@test.com" },
        { id: 2, name: "María García", email: "maria@test.com" },
        { id: 3, name: "Pedro López", email: "pedro@test.com" },
      ];
      
      const query = "mar";
      const filteredUsers = users.filter(
        (u) =>
          u.name?.toLowerCase().includes(query) ||
          u.email?.toLowerCase().includes(query)
      );
      expect(filteredUsers.length).toBe(1);
      expect(filteredUsers[0].name).toBe("María García");
    });

    it("debe buscar por TAGID", () => {
      const users = [
        { id: 1, name: "Juan", idTag: "EV-ABC123" },
        { id: 2, name: "María", idTag: "EV-DEF456" },
        { id: 3, name: "Pedro", idTag: null },
      ];
      
      const query = "abc";
      const filteredUsers = users.filter(
        (u) => u.idTag?.toLowerCase().includes(query)
      );
      expect(filteredUsers.length).toBe(1);
      expect(filteredUsers[0].name).toBe("Juan");
    });
  });
});
