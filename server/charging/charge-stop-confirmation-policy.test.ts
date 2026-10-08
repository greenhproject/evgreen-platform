import { describe, expect, it } from "vitest";
import {
  STOP_CONFIRMATION_TIMEOUT_MS,
  canRetryChargeStop,
  getChargeStopUiState,
  isAcceptedRemoteStopResponse,
  shouldMarkChargeStopTimedOut,
} from "../../shared/charge-stop-confirmation-policy";

describe("charge stop confirmation policy", () => {
  it("distinguishes an accepted remote command from physical completion", () => {
    expect(isAcceptedRemoteStopResponse({ status: "Accepted" })).toBe(true);
    expect(isAcceptedRemoteStopResponse({ status: "Rejected" })).toBe(false);
    expect(getChargeStopUiState({
      transactionStatus: "IN_PROGRESS",
      stopRequestStatus: "ACCEPTED",
      stopRequestedAt: new Date(),
    })).toBe("finalizing");
  });

  it("does not create a duplicate stop command while confirmation is pending", () => {
    const requestedAt = new Date("2026-09-19T05:00:00.000Z");
    expect(canRetryChargeStop("REQUESTED", requestedAt, requestedAt.getTime() + 30_000)).toBe(false);
    expect(getChargeStopUiState({
      transactionStatus: "IN_PROGRESS",
      stopRequestStatus: "REQUESTED",
      stopRequestedAt: requestedAt,
      now: requestedAt.getTime() + 30_000,
    })).toBe("finalizing");
  });

  it("permits a safe retry after an unconfirmed command times out", () => {
    const requestedAt = new Date("2026-09-19T05:00:00.000Z");
    const now = requestedAt.getTime() + STOP_CONFIRMATION_TIMEOUT_MS;
    expect(shouldMarkChargeStopTimedOut({
      transactionStatus: "IN_PROGRESS",
      stopRequestStatus: "ACCEPTED",
      stopRequestedAt: requestedAt,
      now,
    })).toBe(true);
    expect(canRetryChargeStop("TIMED_OUT", requestedAt, now)).toBe(true);
    expect(getChargeStopUiState({
      transactionStatus: "IN_PROGRESS",
      stopRequestStatus: "TIMED_OUT",
      stopRequestedAt: requestedAt,
      now,
    })).toBe("retryable");
  });

  it("never marks a completed charge as retryable", () => {
    expect(getChargeStopUiState({
      transactionStatus: "COMPLETED",
      stopRequestStatus: "ACCEPTED",
      stopRequestedAt: new Date(),
    })).toBe("completed");
  });
});
