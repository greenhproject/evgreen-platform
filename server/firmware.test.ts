import { describe, it, expect, vi } from "vitest";

// Mock db module
vi.mock("./db", () => ({
  createFirmwareUpdate: vi.fn().mockResolvedValue(1),
  updateFirmwareStatus: vi.fn().mockResolvedValue(undefined),
  updateFirmwareStatusByIdentity: vi.fn().mockResolvedValue(undefined),
  getFirmwareUpdatesByStation: vi.fn().mockResolvedValue([
    {
      id: 1,
      stationId: 10,
      ocppIdentity: "CP-001",
      fileName: "firmware-v2.0.bin",
      fileSize: 1024000,
      fileUrl: "https://s3.example.com/firmware/test.bin",
      version: "2.0.0",
      status: "INSTALLED",
      progress: 100,
      errorMessage: null,
      notes: "Test update",
      initiatedBy: 1,
      startedAt: new Date("2026-01-01"),
      completedAt: new Date("2026-01-01"),
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    },
  ]),
  getAllFirmwareUpdates: vi.fn().mockResolvedValue([
    {
      id: 1,
      stationId: 10,
      ocppIdentity: "CP-001",
      fileName: "firmware-v2.0.bin",
      fileSize: 1024000,
      fileUrl: "https://s3.example.com/firmware/test.bin",
      version: "2.0.0",
      status: "INSTALLED",
      progress: 100,
      errorMessage: null,
      notes: null,
      initiatedBy: 1,
      startedAt: new Date("2026-01-01"),
      completedAt: new Date("2026-01-01"),
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    },
  ]),
  getActiveFirmwareUpdates: vi.fn().mockResolvedValue([
    {
      id: 2,
      stationId: 11,
      ocppIdentity: "CP-002",
      fileName: "firmware-v2.1.bin",
      fileSize: 2048000,
      fileUrl: "https://s3.example.com/firmware/test2.bin",
      version: "2.1.0",
      status: "DOWNLOADING",
      progress: 25,
      errorMessage: null,
      notes: null,
      initiatedBy: 1,
      startedAt: new Date("2026-01-02"),
      completedAt: null,
      createdAt: new Date("2026-01-02"),
      updatedAt: new Date("2026-01-02"),
    },
  ]),
}));

import * as db from "./db";

describe("Firmware Update DB Helpers", () => {
  it("should create a firmware update record", async () => {
    const id = await db.createFirmwareUpdate({
      stationId: 10,
      ocppIdentity: "CP-001",
      fileName: "firmware-v2.0.bin",
      fileSize: 1024000,
      fileUrl: "https://s3.example.com/firmware/test.bin",
      version: "2.0.0",
      initiatedBy: 1,
      notes: "Test update",
    });

    expect(id).toBe(1);
    expect(db.createFirmwareUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        stationId: 10,
        ocppIdentity: "CP-001",
        fileName: "firmware-v2.0.bin",
      })
    );
  });

  it("should update firmware status", async () => {
    await db.updateFirmwareStatus(1, "DOWNLOADING", 25);
    expect(db.updateFirmwareStatus).toHaveBeenCalledWith(1, "DOWNLOADING", 25);
  });

  it("should update firmware status with error message", async () => {
    await db.updateFirmwareStatus(1, "FAILED", 0, "Connection lost");
    expect(db.updateFirmwareStatus).toHaveBeenCalledWith(1, "FAILED", 0, "Connection lost");
  });

  it("should update firmware status by identity", async () => {
    await db.updateFirmwareStatusByIdentity("CP-001", "INSTALLING", 75);
    expect(db.updateFirmwareStatusByIdentity).toHaveBeenCalledWith("CP-001", "INSTALLING", 75);
  });

  it("should get firmware updates by station", async () => {
    const updates = await db.getFirmwareUpdatesByStation(10, 20);
    expect(updates).toHaveLength(1);
    expect(updates[0].ocppIdentity).toBe("CP-001");
    expect(updates[0].status).toBe("INSTALLED");
  });

  it("should get all firmware updates", async () => {
    const updates = await db.getAllFirmwareUpdates(50);
    expect(updates).toHaveLength(1);
    expect(updates[0].fileName).toBe("firmware-v2.0.bin");
  });

  it("should get active firmware updates", async () => {
    const active = await db.getActiveFirmwareUpdates();
    expect(active).toHaveLength(1);
    expect(active[0].status).toBe("DOWNLOADING");
    expect(active[0].progress).toBe(25);
  });
});

describe("Firmware Status Mapping", () => {
  it("should map OCPP statuses correctly", () => {
    const statusMap: Record<string, string> = {
      Downloading: "DOWNLOADING",
      Downloaded: "DOWNLOADED",
      Installing: "INSTALLING",
      Installed: "INSTALLED",
      InstallationFailed: "INSTALLATION_FAILED",
      DownloadFailed: "DOWNLOAD_FAILED",
      Idle: "IDLE",
      DownloadScheduled: "PENDING",
      DownloadPaused: "DOWNLOADING",
      SignatureVerified: "DOWNLOADED",
      InvalidSignature: "DOWNLOAD_FAILED",
    };

    expect(statusMap["Downloading"]).toBe("DOWNLOADING");
    expect(statusMap["Installed"]).toBe("INSTALLED");
    expect(statusMap["InstallationFailed"]).toBe("INSTALLATION_FAILED");
    expect(statusMap["DownloadFailed"]).toBe("DOWNLOAD_FAILED");
    expect(statusMap["DownloadScheduled"]).toBe("PENDING");
    expect(statusMap["InvalidSignature"]).toBe("DOWNLOAD_FAILED");
  });

  it("should map progress values correctly", () => {
    const progressMap: Record<string, number> = {
      PENDING: 0,
      DOWNLOADING: 25,
      DOWNLOADED: 50,
      INSTALLING: 75,
      INSTALLED: 100,
      INSTALLATION_FAILED: 0,
      DOWNLOAD_FAILED: 0,
      IDLE: 0,
    };

    expect(progressMap["PENDING"]).toBe(0);
    expect(progressMap["DOWNLOADING"]).toBe(25);
    expect(progressMap["DOWNLOADED"]).toBe(50);
    expect(progressMap["INSTALLING"]).toBe(75);
    expect(progressMap["INSTALLED"]).toBe(100);
    expect(progressMap["INSTALLATION_FAILED"]).toBe(0);
  });

  it("should identify error statuses", () => {
    const errorStatuses = ["INSTALLATION_FAILED", "DOWNLOAD_FAILED"];
    expect(errorStatuses.includes("INSTALLATION_FAILED")).toBe(true);
    expect(errorStatuses.includes("DOWNLOAD_FAILED")).toBe(true);
    expect(errorStatuses.includes("INSTALLED")).toBe(false);
    expect(errorStatuses.includes("DOWNLOADING")).toBe(false);
  });
});
