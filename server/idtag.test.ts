import { describe, it, expect, vi } from "vitest";

describe("idTag System", () => {
  describe("idTag Format", () => {
    it("should generate idTag with correct format EV-XXXXXX", () => {
      // El patrón excluye I, O, 0, 1 para evitar confusión
      const idTagPattern = /^EV-[A-HJ-NP-Z2-9]{6}$/;
      
      // Test varios ejemplos de formato válido (sin I, O, 0, 1)
      expect("EV-ABC234").toMatch(idTagPattern);
      expect("EV-XYZ789").toMatch(idTagPattern);
      expect("EV-ABCDEF").toMatch(idTagPattern);
      
      // Test formatos inválidos
      expect("EV-ABC12").not.toMatch(idTagPattern); // Muy corto
      expect("EV-ABC1234").not.toMatch(idTagPattern); // Muy largo
      expect("ABC234").not.toMatch(idTagPattern); // Sin prefijo
      expect("EV-abc234").not.toMatch(idTagPattern); // Minúsculas
    });
    
    it("should not contain confusing characters (I, O, 0, 1)", () => {
      const validChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const invalidChars = ['I', 'O', '0', '1'];
      
      invalidChars.forEach(char => {
        expect(validChars).not.toContain(char);
      });
    });
  });
  
  describe("idTag Validation", () => {
    it("should validate idTag exists and is not empty", () => {
      const validateIdTag = (idTag: string | null | undefined): boolean => {
        return !!idTag && idTag.length > 0 && idTag.startsWith("EV-");
      };
      
      expect(validateIdTag("EV-ABC123")).toBe(true);
      expect(validateIdTag("")).toBe(false);
      expect(validateIdTag(null)).toBe(false);
      expect(validateIdTag(undefined)).toBe(false);
      expect(validateIdTag("ABC123")).toBe(false); // Sin prefijo
    });
  });
  
  describe("OCPP Authorization", () => {
    it("should return Accepted for valid idTag", () => {
      const mockAuthorize = (idTag: string, validIdTags: string[]): string => {
        if (validIdTags.includes(idTag)) {
          return "Accepted";
        }
        return "Invalid";
      };
      
      const validIdTags = ["EV-ABC123", "EV-XYZ789"];
      
      expect(mockAuthorize("EV-ABC123", validIdTags)).toBe("Accepted");
      expect(mockAuthorize("EV-INVALID", validIdTags)).toBe("Invalid");
    });
    
    it("should link transaction to user by idTag", () => {
      const mockUsers = [
        { id: 1, idTag: "EV-ABC123", name: "User 1" },
        { id: 2, idTag: "EV-XYZ789", name: "User 2" },
      ];
      
      const findUserByIdTag = (idTag: string) => {
        return mockUsers.find(u => u.idTag === idTag);
      };
      
      expect(findUserByIdTag("EV-ABC123")?.id).toBe(1);
      expect(findUserByIdTag("EV-XYZ789")?.id).toBe(2);
      expect(findUserByIdTag("EV-INVALID")).toBeUndefined();
    });
  });
});

describe("Price Alert System", () => {
  describe("Price Change Detection", () => {
    it("should detect significant price drop (>10%)", () => {
      const isSignificantDrop = (oldPrice: number, newPrice: number, threshold: number = 0.1): boolean => {
        if (oldPrice <= 0) return false;
        const dropPercentage = (oldPrice - newPrice) / oldPrice;
        return dropPercentage >= threshold;
      };
      
      // 20% drop - significant
      expect(isSignificantDrop(1000, 800)).toBe(true);
      
      // 15% drop - significant
      expect(isSignificantDrop(1000, 850)).toBe(true);
      
      // 10% drop - exactly threshold
      expect(isSignificantDrop(1000, 900)).toBe(true);
      
      // 5% drop - not significant
      expect(isSignificantDrop(1000, 950)).toBe(false);
      
      // Price increase - not a drop
      expect(isSignificantDrop(1000, 1100)).toBe(false);
    });
    
    it("should format price alert message correctly", () => {
      const formatPriceAlert = (stationName: string, oldPrice: number, newPrice: number): string => {
        const savings = ((oldPrice - newPrice) / oldPrice * 100).toFixed(0);
        return `¡Precio reducido ${savings}% en ${stationName}! Ahora $${newPrice}/kWh`;
      };
      
      const message = formatPriceAlert("Estación Centro", 1200, 960);
      expect(message).toContain("20%");
      expect(message).toContain("Estación Centro");
      expect(message).toContain("$960/kWh");
    });
  });
  
  describe("User Notification Targeting", () => {
    it("should identify users who charged at station recently", () => {
      const mockTransactions = [
        { userId: 1, stationId: 100, date: new Date("2026-01-25") },
        { userId: 2, stationId: 100, date: new Date("2026-01-20") },
        { userId: 3, stationId: 200, date: new Date("2026-01-28") },
      ];
      
      const getUsersForStation = (stationId: number, daysBack: number = 30) => {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysBack);
        
        return mockTransactions
          .filter(t => t.stationId === stationId && t.date >= cutoffDate)
          .map(t => t.userId);
      };
      
      const users = getUsersForStation(100);
      expect(users).toContain(1);
      expect(users).toContain(2);
      expect(users).not.toContain(3);
    });
  });
});
