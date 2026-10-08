import { describe, expect, it } from "vitest";
import { createPushDeliveryId, hashPushToken } from "./push-device-service";

describe("Push device delivery identity", () => {
  it("hashes the token for indexes without exposing it as the lookup key", () => {
    const hash = hashPushToken("fcm-token-example");
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain("fcm-token-example");
    expect(hash).toBe(hashPushToken("fcm-token-example"));
    expect(hash).not.toBe(hashPushToken("other-token"));
  });

  it("creates unique opaque delivery identifiers", () => {
    const first = createPushDeliveryId();
    const second = createPushDeliveryId();
    expect(first).toMatch(/^push_[a-f0-9]{32}$/);
    expect(second).toMatch(/^push_[a-f0-9]{32}$/);
    expect(first).not.toBe(second);
  });
});
