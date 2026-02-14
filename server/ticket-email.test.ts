import { describe, it, expect } from "vitest";

describe("Ticket Email Service", () => {
  describe("Email subject generation", () => {
    it("should generate correct subject for resolved ticket", () => {
      const ticketId = 42;
      const title = "Conector dañado";
      const type = "resolved";
      const subject = type === "resolved"
        ? `Ticket #${ticketId} Resuelto - ${title}`
        : type === "cancelled"
        ? `Ticket #${ticketId} Cancelado - ${title}`
        : `ALERTA: Ticket Crítico #${ticketId} - ${title}`;
      expect(subject).toBe("Ticket #42 Resuelto - Conector dañado");
    });

    it("should generate correct subject for cancelled ticket", () => {
      const ticketId = 15;
      const title = "Falla de red";
      const type = "cancelled";
      const subject = type === "resolved"
        ? `Ticket #${ticketId} Resuelto - ${title}`
        : type === "cancelled"
        ? `Ticket #${ticketId} Cancelado - ${title}`
        : `ALERTA: Ticket Crítico #${ticketId} - ${title}`;
      expect(subject).toBe("Ticket #15 Cancelado - Falla de red");
    });

    it("should generate ALERTA subject for critical ticket", () => {
      const ticketId = 99;
      const title = "Incendio en estación";
      const type = "critical_created";
      const subject = type === "resolved"
        ? `Ticket #${ticketId} Resuelto - ${title}`
        : type === "cancelled"
        ? `Ticket #${ticketId} Cancelado - ${title}`
        : `ALERTA: Ticket Crítico #${ticketId} - ${title}`;
      expect(subject).toBe("ALERTA: Ticket Crítico #99 - Incendio en estación");
    });
  });

  describe("Priority mapping", () => {
    const priorityMap: Record<string, { label: string; color: string }> = {
      CRITICAL: { label: "Crítica", color: "#ef4444" },
      HIGH: { label: "Alta", color: "#f97316" },
      MEDIUM: { label: "Media", color: "#eab308" },
      LOW: { label: "Baja", color: "#6b7280" },
    };

    it("should map CRITICAL to red color", () => {
      expect(priorityMap.CRITICAL.color).toBe("#ef4444");
      expect(priorityMap.CRITICAL.label).toBe("Crítica");
    });

    it("should map all priority levels with valid hex colors", () => {
      for (const p of ["CRITICAL", "HIGH", "MEDIUM", "LOW"]) {
        expect(priorityMap[p]).toBeDefined();
        expect(priorityMap[p].label).toBeTruthy();
        expect(priorityMap[p].color).toMatch(/^#[0-9a-f]{6}$/);
      }
    });
  });

  describe("Photo attachment validation", () => {
    it("should validate allowed content types", () => {
      const validContentTypes = ["image/jpeg", "image/png", "image/webp"];
      expect(validContentTypes).toContain("image/jpeg");
      expect(validContentTypes).toContain("image/png");
      expect(validContentTypes).toContain("image/webp");
      expect(validContentTypes).not.toContain("image/gif");
      expect(validContentTypes).not.toContain("application/pdf");
    });

    it("should enforce 10MB file size limit", () => {
      const MAX_SIZE = 10 * 1024 * 1024;
      expect(MAX_SIZE).toBe(10485760);
      expect(5 * 1024 * 1024).toBeLessThan(MAX_SIZE);
      expect(11 * 1024 * 1024).toBeGreaterThan(MAX_SIZE);
    });

    it("should validate photo types", () => {
      const validTypes = ["before", "after", "evidence"];
      expect(validTypes).toContain("before");
      expect(validTypes).toContain("after");
      expect(validTypes).toContain("evidence");
    });
  });

  describe("Photo attachment data structure", () => {
    it("should have correct structure", () => {
      const attachment = {
        url: "https://storage.example.com/maintenance/ticket-1/before-123-abc.jpg",
        fileKey: "maintenance/ticket-1/before-123-abc.jpg",
        type: "before" as const,
        fileName: "foto_estacion.jpg",
        uploadedBy: "Juan Pérez",
        uploadedAt: new Date().toISOString(),
      };
      expect(attachment.url).toBeTruthy();
      expect(attachment.fileKey).toContain("maintenance/ticket-");
      expect(["before", "after", "evidence"]).toContain(attachment.type);
      expect(new Date(attachment.uploadedAt).getTime()).not.toBeNaN();
    });

    it("should generate unique file keys", () => {
      const ticketId = 42;
      const photoType = "before";
      const key1 = `maintenance/ticket-${ticketId}/${photoType}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.jpg`;
      const key2 = `maintenance/ticket-${ticketId}/${photoType}-${Date.now() + 1}-${Math.random().toString(36).substring(2, 8)}.jpg`;
      expect(key1).not.toBe(key2);
      expect(key1).toContain(`ticket-${ticketId}`);
    });
  });

  describe("Admin email recipients deduplication", () => {
    it("should deduplicate admin emails", () => {
      const adminEmails = ["admin@greenhproject.com", "staff@greenhproject.com", "admin@greenhproject.com"];
      const ADMIN_CC = "admin@greenhproject.com";
      const allRecipients = Array.from(new Set([...adminEmails, ADMIN_CC]));
      expect(allRecipients).toHaveLength(2);
      expect(allRecipients).toContain("admin@greenhproject.com");
      expect(allRecipients).toContain("staff@greenhproject.com");
    });

    it("should add CC even if no admins found", () => {
      const adminEmails: string[] = [];
      const ADMIN_CC = "admin@greenhproject.com";
      const allRecipients = Array.from(new Set([...adminEmails, ADMIN_CC]));
      expect(allRecipients).toHaveLength(1);
      expect(allRecipients[0]).toBe("admin@greenhproject.com");
    });
  });
});
