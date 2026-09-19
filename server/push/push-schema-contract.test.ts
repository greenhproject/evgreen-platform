import { describe, expect, it } from "vitest";
import { pushDeliveryEvents, pushDevices } from "../../drizzle/schema";

describe("Push delivery database contract", () => {
  it("maps device fields to the deployed snake-case columns", () => {
    expect(pushDevices.userId.name).toBe("user_id");
    expect(pushDevices.tokenHash.name).toBe("token_hash");
    expect(pushDevices.platform.name).toBe("platform");
    expect(pushDevices.appVersion.name).toBe("app_version");
    expect(pushDevices.status.name).toBe("status");
    expect(pushDevices.registeredAt.name).toBe("registered_at");
    expect(pushDevices.lastSeenAt.name).toBe("last_seen_at");
    expect(pushDevices.lastAcceptedAt.name).toBe("last_accepted_at");
    expect(pushDevices.lastReceivedAt.name).toBe("last_received_at");
    expect(pushDevices.lastOpenedAt.name).toBe("last_opened_at");
    expect(pushDevices.lastErrorCode.name).toBe("last_error_code");
    expect(pushDevices.lastErrorAt.name).toBe("last_error_at");
  });

  it("maps delivery event fields to the deployed snake-case columns", () => {
    expect(pushDeliveryEvents.deliveryId.name).toBe("delivery_id");
    expect(pushDeliveryEvents.userId.name).toBe("user_id");
    expect(pushDeliveryEvents.deviceId.name).toBe("device_id");
    expect(pushDeliveryEvents.channel.name).toBe("channel");
    expect(pushDeliveryEvents.status.name).toBe("status");
    expect(pushDeliveryEvents.notificationType.name).toBe("notification_type");
    expect(pushDeliveryEvents.providerMessageId.name).toBe("provider_message_id");
    expect(pushDeliveryEvents.requestedAt.name).toBe("requested_at");
    expect(pushDeliveryEvents.acceptedAt.name).toBe("accepted_at");
    expect(pushDeliveryEvents.receivedAt.name).toBe("received_at");
    expect(pushDeliveryEvents.openedAt.name).toBe("opened_at");
    expect(pushDeliveryEvents.failedAt.name).toBe("failed_at");
    expect(pushDeliveryEvents.errorCode.name).toBe("error_code");
    expect(pushDeliveryEvents.errorMessage.name).toBe("error_message");
  });
});
