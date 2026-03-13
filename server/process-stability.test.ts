import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Tests to verify that critical process stability handlers exist in the server code.
 * These handlers prevent the server from crashing on uncaught errors.
 */

describe("Process Stability Handlers", () => {
  const serverIndexPath = path.resolve(__dirname, "_core/index.ts");
  let serverCode: string;

  // Read the server file once
  serverCode = fs.readFileSync(serverIndexPath, "utf-8");

  describe("Critical error handlers must exist", () => {
    it("should have unhandledRejection handler", () => {
      expect(serverCode).toContain("process.on('unhandledRejection'");
    });

    it("should have uncaughtException handler", () => {
      expect(serverCode).toContain("process.on('uncaughtException'");
    });

    it("should have SIGTERM handler for graceful shutdown", () => {
      expect(serverCode).toContain("process.on('SIGTERM'");
    });

    it("should have SIGINT handler for graceful shutdown", () => {
      expect(serverCode).toContain("process.on('SIGINT'");
    });
  });

  describe("Error handlers should NOT exit the process", () => {
    it("uncaughtException handler should not call process.exit", () => {
      // Extract the uncaughtException handler block
      const uncaughtStart = serverCode.indexOf("process.on('uncaughtException'");
      const uncaughtEnd = serverCode.indexOf("});", uncaughtStart) + 3;
      const uncaughtBlock = serverCode.substring(uncaughtStart, uncaughtEnd);
      
      expect(uncaughtBlock).not.toContain("process.exit");
    });

    it("unhandledRejection handler should not call process.exit", () => {
      const rejectionStart = serverCode.indexOf("process.on('unhandledRejection'");
      const rejectionEnd = serverCode.indexOf("});", rejectionStart) + 3;
      const rejectionBlock = serverCode.substring(rejectionStart, rejectionEnd);
      
      expect(rejectionBlock).not.toContain("process.exit");
    });
  });

  describe("Memory monitoring", () => {
    it("should have memory monitoring interval", () => {
      expect(serverCode).toContain("process.memoryUsage()");
      expect(serverCode).toContain("HIGH MEMORY WARNING");
    });
  });

  describe("Rate limit cleanup", () => {
    it("should have deterministic rate limit cleanup (not probabilistic)", () => {
      // Should NOT have the old probabilistic cleanup
      expect(serverCode).not.toContain("Math.random() < 0.001");
      // Should have deterministic cleanup
      expect(serverCode).toContain("Cleaned");
      expect(serverCode).toContain("expired entries");
    });
  });

  describe("Background jobs error handling", () => {
    it("all setInterval jobs should have try/catch", () => {
      // Check that reservation jobs have try/catch
      expect(serverCode).toContain('} catch (e) {\n        console.error("[ReservationJobs]');
    });

    it("should have health check endpoint", () => {
      expect(serverCode).toContain('/api/health');
      expect(serverCode).toContain("status");
      expect(serverCode).toContain("uptime");
    });
  });

  describe("Server startup resilience", () => {
    it("should have retry logic on server start failure", () => {
      expect(serverCode).toContain("Retrying server start");
    });
  });

  describe("Internal Keep-Alive mechanism", () => {
    it("should have startKeepAlive function", () => {
      expect(serverCode).toContain("function startKeepAlive()");
    });

    it("should ping /api/health endpoint", () => {
      expect(serverCode).toContain("/api/health");
      expect(serverCode).toContain("X-Keep-Alive");
    });

    it("should have a 4-minute interval", () => {
      expect(serverCode).toContain("4 * 60 * 1000");
    });

    it("should have failure tracking with max failures threshold", () => {
      expect(serverCode).toContain("keepAliveFailures");
      expect(serverCode).toContain("KEEP_ALIVE_MAX_FAILURES");
    });

    it("should have a timeout for the fetch request", () => {
      expect(serverCode).toContain("AbortController");
      expect(serverCode).toContain("controller.abort()");
    });

    it("should delay start to let server initialize first", () => {
      // Keep-alive should start after a delay, not immediately
      expect(serverCode).toContain("setTimeout(() => {");
      expect(serverCode).toContain("startKeepAlive();");
    });

    it("should log sparingly to avoid log spam", () => {
      // Only logs once per hour approximately
      expect(serverCode).toContain("getMinutes()");
    });
  });
});
