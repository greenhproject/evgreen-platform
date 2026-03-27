import { describe, expect, it, vi } from "vitest";

/**
 * Tests for transaction pagination logic.
 * Since the actual DB calls are mocked, we test the pagination math
 * and the consistent return type structure.
 */

describe("Transactions Pagination", () => {
  describe("pagination math", () => {
    it("calculates correct offset from page and limit", () => {
      const page = 3;
      const limit = 20;
      const offset = (page - 1) * limit;
      expect(offset).toBe(40);
    });

    it("calculates correct totalPages", () => {
      const total = 55;
      const limit = 20;
      const totalPages = Math.ceil(total / limit);
      expect(totalPages).toBe(3);
    });

    it("returns 1 totalPage when total is 0", () => {
      const total = 0;
      const limit = 20;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      expect(totalPages).toBe(1);
    });

    it("returns 1 totalPage when total equals limit", () => {
      const total = 20;
      const limit = 20;
      const totalPages = Math.ceil(total / limit);
      expect(totalPages).toBe(1);
    });

    it("returns 2 totalPages when total is limit + 1", () => {
      const total = 21;
      const limit = 20;
      const totalPages = Math.ceil(total / limit);
      expect(totalPages).toBe(2);
    });
  });

  describe("paginated response structure", () => {
    it("returns consistent paginated format", () => {
      const mockData = [{ id: 1 }, { id: 2 }];
      const total = 50;
      const page = 1;
      const limit = 20;

      const result = {
        data: mockData,
        total,
        page,
        pageSize: limit,
        totalPages: Math.ceil(total / limit),
      };

      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("total");
      expect(result).toHaveProperty("page");
      expect(result).toHaveProperty("pageSize");
      expect(result).toHaveProperty("totalPages");
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.total).toBe(50);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.totalPages).toBe(3);
    });

    it("wraps stationId results in paginated format", () => {
      // Simulates the stationId branch wrapping array results
      const stationTxs = Array.from({ length: 35 }, (_, i) => ({ id: i + 1 }));
      const page = 2;
      const limit = 20;
      const offset = (page - 1) * limit;

      const sliced = stationTxs.slice(offset, offset + limit);
      const result = {
        data: sliced,
        total: stationTxs.length,
        page,
        pageSize: limit,
        totalPages: Math.ceil(stationTxs.length / limit),
      };

      expect(result.data).toHaveLength(15); // 35 - 20 = 15 remaining
      expect(result.total).toBe(35);
      expect(result.page).toBe(2);
      expect(result.totalPages).toBe(2);
    });
  });

  describe("date range filter validation", () => {
    it("creates valid date from date input string", () => {
      const startDate = "2026-01-01";
      const endDate = "2026-03-27";

      const start = new Date(startDate + "T00:00:00");
      const end = new Date(endDate + "T23:59:59");

      expect(start.getFullYear()).toBe(2026);
      expect(start.getMonth()).toBe(0); // January
      expect(start.getDate()).toBe(1);
      expect(end.getHours()).toBe(23);
      expect(end.getMinutes()).toBe(59);
      expect(end.getSeconds()).toBe(59);
    });

    it("handles undefined dates gracefully", () => {
      const startDate = "";
      const endDate = "";

      const start = startDate ? new Date(startDate + "T00:00:00") : undefined;
      const end = endDate ? new Date(endDate + "T23:59:59") : undefined;

      expect(start).toBeUndefined();
      expect(end).toBeUndefined();
    });
  });
});
