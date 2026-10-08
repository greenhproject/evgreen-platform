import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  getPendingAlertsByStation: vi.fn(),
  claimAvailabilityAlert: vi.fn(),
  getUserById: vi.fn(),
  createNotification: vi.fn(),
  completeAvailabilityAlertAttempt: vi.fn(),
}));
const pushMocks = vi.hoisted(() => ({ sendUserPush: vi.fn() }));
const whatsappMocks = vi.hoisted(() => ({
  getConfiguredStationAvailabilityTemplate: vi.fn(),
  sendWhatsAppTemplate: vi.fn(),
}));

vi.mock("../db", () => dbMocks);
vi.mock("../push/unified-push", () => pushMocks);
vi.mock("../whatsapp/whatsapp-service", () => whatsappMocks);

import { dispatchAvailabilityAlerts } from "./availability-alert-dispatcher";

const baseAlert = {
  id: 123,
  userId: 88,
  stationId: 7,
  stationName: "EVG Diamante",
  connectorType: "GBT_AC",
  userName: "Luis",
  userPhone: "573001112233",
  sendPush: 1,
  sendWhatsapp: 1,
  pushStatus: "PENDING",
  whatsappStatus: "PENDING",
  attemptCount: 1,
};

describe("dispatchAvailabilityAlerts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.getPendingAlertsByStation.mockResolvedValue([baseAlert]);
    dbMocks.claimAvailabilityAlert.mockResolvedValue(baseAlert);
    dbMocks.getUserById.mockResolvedValue({ id: 88, name: "Luis", pushSubscription: "{}", fcmToken: null });
    dbMocks.createNotification.mockResolvedValue(1);
    dbMocks.completeAvailabilityAlertAttempt.mockResolvedValue(undefined);
  });

  it("registra entrega sólo cuando Push y la plantilla aprobada confirman el envío", async () => {
    pushMocks.sendUserPush.mockResolvedValue(true);
    whatsappMocks.getConfiguredStationAvailabilityTemplate.mockResolvedValue({
      name: "evgreen_estacion_disponible_v1",
      status: "APPROVED",
      canSend: true,
    });
    whatsappMocks.sendWhatsAppTemplate.mockResolvedValue(true);

    await dispatchAvailabilityAlerts(7, "GBT_AC");

    expect(pushMocks.sendUserPush).toHaveBeenCalledWith(88, expect.objectContaining({ type: "station_available" }));
    expect(whatsappMocks.sendWhatsAppTemplate).toHaveBeenCalledWith(expect.objectContaining({
      templateName: "evgreen_estacion_disponible_v1",
      eventType: "station_available",
      referenceId: 123,
    }));
    expect(dbMocks.completeAvailabilityAlertAttempt).toHaveBeenCalledWith(expect.objectContaining({
      alertId: 123,
      pushStatus: "SENT",
      whatsappStatus: "SENT",
    }));
  });

  it("no promete ni marca WhatsApp enviado mientras la plantilla continúa en revisión", async () => {
    dbMocks.getUserById.mockResolvedValue({ id: 88, name: "Luis", pushSubscription: null, fcmToken: null });
    whatsappMocks.getConfiguredStationAvailabilityTemplate.mockResolvedValue({
      name: "evgreen_estacion_disponible_v1",
      status: "IN_REVIEW",
      canSend: false,
      reason: "La plantilla de disponibilidad aún no está aprobada por Meta",
    });

    await dispatchAvailabilityAlerts(7, "GBT_AC");

    expect(pushMocks.sendUserPush).not.toHaveBeenCalled();
    expect(whatsappMocks.sendWhatsAppTemplate).not.toHaveBeenCalled();
    expect(dbMocks.completeAvailabilityAlertAttempt).toHaveBeenCalledWith(expect.objectContaining({
      alertId: 123,
      pushStatus: "NOT_AVAILABLE",
      whatsappStatus: "WAITING_TEMPLATE",
    }));
  });
});
