import { describe, expect, it, beforeAll } from "vitest";

// JWT_SECRET must be set before importing the module, since it's read at
// module scope (ENV.cookieSecret) and reused for signing/verifying.
beforeAll(() => {
  if (!process.env.JWT_SECRET) process.env.JWT_SECRET = "test-secret-for-auth0-mobile-oauth-state";
});

describe("resolveMobileCallbackState (evgreen-native login fix)", () => {
  it("prefers the cookie when it's present, exactly like before the fix (no behavior change for the working case)", async () => {
    const { resolveMobileCallbackState } = await import("./_core/auth0");
    const result = await resolveMobileCallbackState({
      isMobile: true,
      storedState: "cookie-state-value",
      incomingState: "cookie-state-value",
      cookieSk: "sk-from-cookie",
    });
    expect(result.stateCheck).toBe("cookie-state-value");
    expect(result.sk).toBe("sk-from-cookie");
    expect(result.usedSignedFallback).toBe(false);
  });

  it("falls back to the signed state and recovers sk from it when the cookie never arrives (the real production bug)", async () => {
    const auth0 = await import("./_core/auth0");
    const { registerAuth0Routes } = auth0;
    expect(registerAuth0Routes).toBeTypeOf("function");

    // Reach the real signing function through the same login flow the server uses,
    // by re-deriving the signed state with jose directly against the same secret
    // the module uses (ENV.cookieSecret / JWT_SECRET), to avoid needing an HTTP server.
    const { SignJWT } = await import("jose");
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const signed = await new SignJWT({ n: "abc123", sk: "native-sk-value" })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(Math.floor((Date.now() + 5 * 60 * 1000) / 1000))
      .sign(secret);
    const incomingState = `${signed}:m`;

    const { resolveMobileCallbackState } = auth0;
    const result = await resolveMobileCallbackState({
      isMobile: true,
      storedState: undefined, // this is exactly what production logs showed: storedState=MISSING
      incomingState,
      cookieSk: null, // auth0_sk cookie also never arrived, same root cause
    });

    expect(result.usedSignedFallback).toBe(true);
    expect(result.sk).toBe("native-sk-value");
    // Must be defined (not undefined) so openid-client's callback() doesn't throw
    // "checks.state argument is missing" — the exact error seen in production.
    expect(result.stateCheck).toBe(incomingState);
  });

  it("does not accept a tampered or expired signed state — still fails closed, just like before the fix", async () => {
    const { resolveMobileCallbackState } = await import("./_core/auth0");
    const { SignJWT } = await import("jose");
    const wrongSecret = new TextEncoder().encode("a-different-secret-entirely");
    const forged = await new SignJWT({ n: "abc123", sk: "attacker-controlled-sk" })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(Math.floor((Date.now() + 5 * 60 * 1000) / 1000))
      .sign(wrongSecret);

    const result = await resolveMobileCallbackState({
      isMobile: true,
      storedState: undefined,
      incomingState: `${forged}:m`,
      cookieSk: null,
    });

    // Falls through to the original (pre-fix) failure behavior: undefined state,
    // which openid-client correctly rejects — a forged state must never validate.
    expect(result.stateCheck).toBeUndefined();
    expect(result.usedSignedFallback).toBe(false);
  });

  it("an expired signed state is rejected", async () => {
    const { resolveMobileCallbackState } = await import("./_core/auth0");
    const { SignJWT } = await import("jose");
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const expired = await new SignJWT({ n: "abc123", sk: "native-sk-value" })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(Math.floor((Date.now() - 60 * 1000) / 1000)) // already expired
      .sign(secret);

    const result = await resolveMobileCallbackState({
      isMobile: true,
      storedState: undefined,
      incomingState: `${expired}:m`,
      cookieSk: null,
    });

    expect(result.stateCheck).toBeUndefined();
    expect(result.usedSignedFallback).toBe(false);
  });

  it("the non-mobile (web) path is completely unaffected: missing cookie still fails closed exactly like before", async () => {
    const { resolveMobileCallbackState } = await import("./_core/auth0");
    const result = await resolveMobileCallbackState({
      isMobile: false,
      storedState: undefined,
      incomingState: "some-random-non-mobile-state",
      cookieSk: null,
    });
    expect(result.stateCheck).toBeUndefined();
    expect(result.usedSignedFallback).toBe(false);
  });
});
