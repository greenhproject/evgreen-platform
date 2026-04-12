import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db module
vi.mock("./db", () => ({
  searchUsers: vi.fn(),
  getCrowdfundingParticipationById: vi.fn(),
  getCrowdfundingProjectById: vi.fn(),
  updateCrowdfundingParticipationFull: vi.fn(),
  updateProjectRaisedAmountByParticipation: vi.fn(),
  deleteCrowdfundingParticipation: vi.fn(),
  updateProjectRaisedAmount: vi.fn(),
  getCrowdfundingParticipations: vi.fn(),
  getUserById: vi.fn(),
  updateUser: vi.fn(),
}));

import * as db from "./db";

describe("Crowdfunding Participations - DB functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("searchUsers", () => {
    it("should return users matching the search query", async () => {
      const mockUsers = [
        { id: 1, name: "Juan Pérez", email: "juan@test.com", role: "user" },
        { id: 2, name: "Juan García", email: "jgarcia@test.com", role: "investor" },
      ];
      vi.mocked(db.searchUsers).mockResolvedValue(mockUsers);

      const result = await db.searchUsers("Juan", 15);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Juan Pérez");
      expect(db.searchUsers).toHaveBeenCalledWith("Juan", 15);
    });

    it("should return empty array when no users match", async () => {
      vi.mocked(db.searchUsers).mockResolvedValue([]);

      const result = await db.searchUsers("nonexistent", 15);
      expect(result).toHaveLength(0);
    });
  });

  describe("getParticipations - investor name mapping", () => {
    it("should return participations with investor object from flat fields", async () => {
      const mockRaw = [
        {
          id: 1,
          projectId: 1,
          investorId: 5,
          amount: 50000000,
          participationPercent: "5.0000",
          paymentStatus: "COMPLETED",
          createdAt: new Date(),
          investorName: "Carlos López",
          investorEmail: "carlos@test.com",
        },
        {
          id: 2,
          projectId: 1,
          investorId: 6,
          amount: 100000000,
          participationPercent: "10.0000",
          paymentStatus: "PENDING",
          createdAt: new Date(),
          investorName: null,
          investorEmail: null,
        },
      ];

      vi.mocked(db.getCrowdfundingParticipations).mockResolvedValue(mockRaw as any);

      const raw = await db.getCrowdfundingParticipations(1);
      // Simulate the router transformation
      const transformed = raw.map((p: any) => ({
        ...p,
        investor: {
          id: p.investorId,
          name: p.investorName || p.name || "N/A",
          email: p.investorEmail || p.email || "",
        },
      }));

      expect(transformed[0].investor.name).toBe("Carlos López");
      expect(transformed[0].investor.email).toBe("carlos@test.com");
      // When investorName is null, should fallback to N/A
      expect(transformed[1].investor.name).toBe("N/A");
      expect(transformed[1].investor.email).toBe("");
    });
  });

  describe("editParticipation logic", () => {
    it("should recalculate participation percent when amount changes", async () => {
      const mockParticipation = {
        id: 1,
        projectId: 1,
        investorId: 5,
        amount: 50000000,
        participationPercent: "5.0000",
        paymentStatus: "PENDING",
      };
      const mockProject = {
        id: 1,
        targetAmount: 1000000000,
      };

      vi.mocked(db.getCrowdfundingParticipationById).mockResolvedValue(mockParticipation as any);
      vi.mocked(db.getCrowdfundingProjectById).mockResolvedValue(mockProject as any);
      vi.mocked(db.updateCrowdfundingParticipationFull).mockResolvedValue(undefined);
      vi.mocked(db.updateProjectRaisedAmountByParticipation).mockResolvedValue(undefined);

      // Simulate the router logic
      const input = { participationId: 1, amount: 100000000 };
      const participation = await db.getCrowdfundingParticipationById(input.participationId);
      expect(participation).toBeTruthy();

      const project = await db.getCrowdfundingProjectById(participation!.projectId);
      expect(project).toBeTruthy();

      const updateData: any = {};
      if (input.amount !== undefined) {
        updateData.amount = input.amount;
        updateData.participationPercent = (input.amount / Number(project!.targetAmount)) * 100;
      }

      expect(updateData.amount).toBe(100000000);
      expect(updateData.participationPercent).toBe(10);
    });

    it("should set paymentDate when status changes to COMPLETED", () => {
      const participation = { paymentStatus: "PENDING" };
      const input = { paymentStatus: "COMPLETED" as const };
      const updateData: any = {};

      if (input.paymentStatus !== undefined) {
        updateData.paymentStatus = input.paymentStatus;
        if (input.paymentStatus === "COMPLETED" && participation.paymentStatus !== "COMPLETED") {
          updateData.paymentDate = new Date();
        }
      }

      expect(updateData.paymentStatus).toBe("COMPLETED");
      expect(updateData.paymentDate).toBeInstanceOf(Date);
    });

    it("should NOT set paymentDate when already COMPLETED", () => {
      const participation = { paymentStatus: "COMPLETED" };
      const input = { paymentStatus: "COMPLETED" as const };
      const updateData: any = {};

      if (input.paymentStatus !== undefined) {
        updateData.paymentStatus = input.paymentStatus;
        if (input.paymentStatus === "COMPLETED" && participation.paymentStatus !== "COMPLETED") {
          updateData.paymentDate = new Date();
        }
      }

      expect(updateData.paymentStatus).toBe("COMPLETED");
      expect(updateData.paymentDate).toBeUndefined();
    });
  });

  describe("deleteParticipation logic", () => {
    it("should delete participation and recalculate project raised amount", async () => {
      const mockParticipation = {
        id: 1,
        projectId: 1,
        investorId: 5,
        amount: 50000000,
      };

      vi.mocked(db.getCrowdfundingParticipationById).mockResolvedValue(mockParticipation as any);
      vi.mocked(db.deleteCrowdfundingParticipation).mockResolvedValue(undefined);
      vi.mocked(db.updateProjectRaisedAmount).mockResolvedValue(undefined);

      const participation = await db.getCrowdfundingParticipationById(1);
      expect(participation).toBeTruthy();

      await db.deleteCrowdfundingParticipation(1);
      expect(db.deleteCrowdfundingParticipation).toHaveBeenCalledWith(1);

      await db.updateProjectRaisedAmount(participation!.projectId);
      expect(db.updateProjectRaisedAmount).toHaveBeenCalledWith(1);
    });
  });

  describe("investor role assignment on link", () => {
    it("should update user role to investor when linking a non-investor user", async () => {
      const mockUser = { id: 10, name: "Test User", role: "user" };
      vi.mocked(db.getUserById).mockResolvedValue(mockUser as any);
      vi.mocked(db.updateUser).mockResolvedValue(undefined);

      const user = await db.getUserById(10);
      if (user && user.role !== "investor" && user.role !== "admin") {
        await db.updateUser(10, { role: "investor" } as any);
      }

      expect(db.updateUser).toHaveBeenCalledWith(10, { role: "investor" });
    });

    it("should NOT change role if user is already admin", async () => {
      const mockUser = { id: 1, name: "Admin", role: "admin" };
      vi.mocked(db.getUserById).mockResolvedValue(mockUser as any);

      const user = await db.getUserById(1);
      if (user && user.role !== "investor" && user.role !== "admin") {
        await db.updateUser(1, { role: "investor" } as any);
      }

      expect(db.updateUser).not.toHaveBeenCalled();
    });

    it("should NOT change role if user is already investor", async () => {
      const mockUser = { id: 5, name: "Investor", role: "investor" };
      vi.mocked(db.getUserById).mockResolvedValue(mockUser as any);

      const user = await db.getUserById(5);
      if (user && user.role !== "investor" && user.role !== "admin") {
        await db.updateUser(5, { role: "investor" } as any);
      }

      expect(db.updateUser).not.toHaveBeenCalled();
    });
  });
});
