/**
 * Tests for balance-monitor push notification integration
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db module
vi.mock("../db", () => ({
  getUserById: vi.fn(),
  getDb: vi.fn(),
  getWalletByUserId: vi.fn(),
  getUserSubscription: vi.fn(),
  createNotification: vi.fn(),
  createWompiTransaction: vi.fn(),
  updateWompiTransactionByReference: vi.fn(),
  createWalletTransaction: vi.fn(),
  updateWalletBalance: vi.fn(),
  getChargingStationById: vi.fn(),
  createOcppLog: vi.fn(),
}));

// Mock FCM module
vi.mock("../firebase/fcm", () => ({
  sendPushNotification: vi.fn().mockResolvedValue(true),
}));

// Mock OCPP
vi.mock("../ocpp/csms-dual", () => ({
  dualCSMS: {
    requestStopTransaction: vi.fn(),
    sendCommandIfConnected: vi.fn(),
  },
}));

// Mock Wompi modules
vi.mock("../wompi/config", () => ({
  getWompiKeys: vi.fn(),
  generatePaymentReference: vi.fn().mockReturnValue("ARC-test-123"),
  generateIntegritySignature: vi.fn().mockReturnValue("sig-test"),
  getTransactionStatus: vi.fn(),
}));

vi.mock("../wompi/recurring-billing", () => ({
  getAcceptanceToken: vi.fn(),
}));

import * as db from "../db";
import { sendPushNotification } from "../firebase/fcm";

describe("Balance Monitor - Push Notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("sendBalancePush", () => {
    it("should be exported from balance-monitor", async () => {
      const mod = await import("./balance-monitor");
      expect(mod.sendBalancePush).toBeDefined();
      expect(typeof mod.sendBalancePush).toBe("function");
    });

    it("should send push notification when user has valid FCM token", async () => {
      const mockUser = {
        id: 1,
        email: "test@evgreen.co",
        name: "Test User",
        fcmToken: "fcm_real_token_abc123",
      };
      vi.mocked(db.getUserById).mockResolvedValue(mockUser as any);
      vi.mocked(sendPushNotification).mockResolvedValue(true);

      const { sendBalancePush } = await import("./balance-monitor");
      await sendBalancePush(1, "low_balance", "Saldo bajo", "Tu saldo es bajo", "/wallet");

      expect(db.getUserById).toHaveBeenCalledWith(1);
      expect(sendPushNotification).toHaveBeenCalledWith("fcm_real_token_abc123", {
        type: "low_balance",
        title: "Saldo bajo",
        body: "Tu saldo es bajo",
        clickAction: "/wallet",
        data: {
          actionUrl: "/wallet",
          userId: "1",
        },
      });
    });

    it("should skip push when user has no FCM token", async () => {
      const mockUser = {
        id: 2,
        email: "notoken@evgreen.co",
        name: "No Token User",
        fcmToken: null,
      };
      vi.mocked(db.getUserById).mockResolvedValue(mockUser as any);

      const { sendBalancePush } = await import("./balance-monitor");
      await sendBalancePush(2, "low_balance", "Saldo bajo", "Tu saldo es bajo", "/wallet");

      expect(db.getUserById).toHaveBeenCalledWith(2);
      expect(sendPushNotification).not.toHaveBeenCalled();
    });

    it("should skip push when user has local token (not real FCM)", async () => {
      const mockUser = {
        id: 3,
        email: "local@evgreen.co",
        name: "Local Token User",
        fcmToken: "local_1234567890_abcdef",
      };
      vi.mocked(db.getUserById).mockResolvedValue(mockUser as any);

      const { sendBalancePush } = await import("./balance-monitor");
      await sendBalancePush(3, "low_balance", "Saldo bajo", "Tu saldo es bajo", "/wallet");

      expect(db.getUserById).toHaveBeenCalledWith(3);
      expect(sendPushNotification).not.toHaveBeenCalled();
    });

    it("should skip push when user is not found", async () => {
      vi.mocked(db.getUserById).mockResolvedValue(undefined);

      const { sendBalancePush } = await import("./balance-monitor");
      await sendBalancePush(999, "low_balance", "Saldo bajo", "Tu saldo es bajo", "/wallet");

      expect(db.getUserById).toHaveBeenCalledWith(999);
      expect(sendPushNotification).not.toHaveBeenCalled();
    });

    it("should not throw when push notification fails", async () => {
      const mockUser = {
        id: 4,
        email: "fail@evgreen.co",
        name: "Fail User",
        fcmToken: "fcm_token_that_will_fail",
      };
      vi.mocked(db.getUserById).mockResolvedValue(mockUser as any);
      vi.mocked(sendPushNotification).mockRejectedValue(new Error("FCM error"));

      const { sendBalancePush } = await import("./balance-monitor");

      // Should not throw
      await expect(
        sendBalancePush(4, "system_alert", "Error", "Algo falló", "/wallet")
      ).resolves.toBeUndefined();
    });

    it("should send correct notification type for each balance event", async () => {
      const mockUser = {
        id: 5,
        email: "types@evgreen.co",
        name: "Types User",
        fcmToken: "fcm_valid_token_xyz",
      };
      vi.mocked(db.getUserById).mockResolvedValue(mockUser as any);
      vi.mocked(sendPushNotification).mockResolvedValue(true);

      const { sendBalancePush } = await import("./balance-monitor");

      // Test balance_added (auto-recharge success)
      await sendBalancePush(5, "balance_added", "Recarga exitosa", "Se recargaron $20,000", "/wallet");
      expect(sendPushNotification).toHaveBeenLastCalledWith(
        "fcm_valid_token_xyz",
        expect.objectContaining({ type: "balance_added" })
      );

      // Test system_alert (auto-recharge failed)
      await sendBalancePush(5, "system_alert", "Recarga fallida", "No se pudo recargar", "/wallet");
      expect(sendPushNotification).toHaveBeenLastCalledWith(
        "fcm_valid_token_xyz",
        expect.objectContaining({ type: "system_alert" })
      );

      // Test charging_error (charge stopped)
      await sendBalancePush(5, "charging_error", "Carga detenida", "Saldo insuficiente", "/wallet");
      expect(sendPushNotification).toHaveBeenLastCalledWith(
        "fcm_valid_token_xyz",
        expect.objectContaining({ type: "charging_error" })
      );

      // Test low_balance
      await sendBalancePush(5, "low_balance", "Saldo bajo", "Tu saldo es bajo", "/wallet");
      expect(sendPushNotification).toHaveBeenLastCalledWith(
        "fcm_valid_token_xyz",
        expect.objectContaining({ type: "low_balance" })
      );
    });
  });

  describe("Balance monitor integration", () => {
    it("should import sendPushNotification from firebase/fcm", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const content = fs.readFileSync(
        path.join(__dirname, "balance-monitor.ts"),
        "utf-8"
      );
      expect(content).toContain('import { sendPushNotification } from "../firebase/fcm"');
      expect(content).toContain('import type { NotificationType } from "../firebase/fcm"');
    });

    it("should call sendBalancePush in all notification scenarios", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const content = fs.readFileSync(
        path.join(__dirname, "balance-monitor.ts"),
        "utf-8"
      );

      // Auto-recharge success
      expect(content).toContain('sendBalancePush(userId, "balance_added"');
      // Auto-recharge failed
      expect(content).toContain('sendBalancePush(userId, "system_alert"');
      // Low balance
      expect(content).toContain('sendBalancePush(userId, "low_balance"');
      // Charge stopped
      expect(content).toContain('sendBalancePush(userId, "charging_error"');
      // Auto-recharge disabled
      expect(content).toContain('sendBalancePush(userId, "system_alert", disabledTitle');
    });

    it("should skip local tokens that start with 'local_'", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const content = fs.readFileSync(
        path.join(__dirname, "balance-monitor.ts"),
        "utf-8"
      );
      expect(content).toContain('fcmToken.startsWith("local_")');
    });
  });
});
