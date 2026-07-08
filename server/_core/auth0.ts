/**
 * Auth0 Authentication Module
 * Replaces Manus OAuth with Auth0 OIDC flow
 */
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import { Issuer, generators } from "openid-client";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { ENV } from "./env";

// Auth0 configuration from environment variables
const AUTH0_DOMAIN = ENV.auth0Domain;
const AUTH0_CLIENT_ID = ENV.auth0ClientId;
const AUTH0_CLIENT_SECRET = ENV.auth0ClientSecret;

let auth0Client: any = null;

async function getAuth0Client() {
  if (auth0Client) return auth0Client;

  if (!AUTH0_DOMAIN || !AUTH0_CLIENT_ID || !AUTH0_CLIENT_SECRET) {
    console.error("[Auth0] Missing configuration. Set AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET");
    return null;
  }

  try {
    const issuer = await Issuer.discover(`https://${AUTH0_DOMAIN}`);
    auth0Client = new issuer.Client({
      client_id: AUTH0_CLIENT_ID,
      client_secret: AUTH0_CLIENT_SECRET,
      redirect_uris: [],
      response_types: ["code"],
    });
    console.log("[Auth0] Client initialized for domain:", AUTH0_DOMAIN);
    return auth0Client;
  } catch (error) {
    console.error("[Auth0] Failed to initialize client:", error);
    return null;
  }
}

// Initialize on startup
getAuth0Client().catch(console.error);

/**
 * Get the origin URL respecting reverse proxy headers (Railway uses x-forwarded-proto)
 */
function getOrigin(req: Request): string {
  const proto = req.headers["x-forwarded-proto"]
    ? String(req.headers["x-forwarded-proto"]).split(",")[0].trim()
    : req.protocol;
  // Cloud Run / reverse proxies set x-forwarded-host with the original domain
  const forwardedHost = req.headers["x-forwarded-host"]
    ? String(req.headers["x-forwarded-host"]).split(",")[0].trim()
    : null;
  const host = forwardedHost || req.get("host") || "localhost";
  return `${proto}://${host}`;
}

export function registerAuth0Routes(app: Express) {
  // Trust proxy (Railway runs behind a reverse proxy)
  app.set("trust proxy", true);

  // Login route - redirects to Auth0
  app.get("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const client = await getAuth0Client();
      if (!client) {
        res.status(500).json({ error: "Auth0 not configured" });
        return;
      }

      const origin = getOrigin(req);
      const redirectUri = `${origin}/api/auth/callback`;

      // Encode mobile flag directly in state so it survives the OAuth redirect chain
      // without relying on cookies (which can be partitioned or blocked in Chrome CCT).
      const nonce = generators.state();
      const isMobilePlatform = req.query.platform === "mobile";
      const state = isMobilePlatform ? `${nonce}:m` : nonce;

      // Store state in a short-lived cookie for CSRF validation
      const isSecure = origin.startsWith("https");
      res.cookie("auth0_state", state, {
        httpOnly: true,
        secure: isSecure,
        sameSite: isSecure ? "none" : "lax",
        maxAge: 5 * 60 * 1000, // 5 minutes
        path: "/",
      });

      const authUrl = client.authorizationUrl({
        scope: "openid profile email",
        redirect_uri: redirectUri,
        state,
        prompt: "login", // Force login screen (no auto-login with cached session)
      });

      res.redirect(authUrl);
    } catch (error) {
      console.error("[Auth0] Login redirect failed:", error);
      res.status(500).json({ error: "Failed to initiate login" });
    }
  });

  // Callback route - handles Auth0 response
  app.get("/api/auth/callback", async (req: Request, res: Response) => {
    try {
      const client = await getAuth0Client();
      if (!client) {
        res.status(500).json({ error: "Auth0 not configured" });
        return;
      }

      const origin = getOrigin(req);
      const redirectUri = `${origin}/api/auth/callback`;

      // Get the state from cookie and extract mobile flag from the state value itself
      const storedState = req.cookies?.auth0_state;
      const params = client.callbackParams(req);

      // Mobile flag is encoded as ":m" suffix in the state to survive cross-site redirects
      const incomingState: string = (params as any).state || '';
      const isMobile = incomingState.endsWith(':m') || req.cookies?.auth0_mobile === "1";

      const tokenSet = await client.callback(redirectUri, params, {
        state: storedState,
      });

      // Clear state and legacy mobile cookies
      res.clearCookie("auth0_state", { path: "/" });
      res.clearCookie("auth0_mobile", { path: "/" });

      // Get user info from Auth0
      const userInfo = await client.userinfo(tokenSet.access_token!);

      if (!userInfo.sub) {
        res.status(400).json({ error: "No user identifier from Auth0" });
        return;
      }

      // Use Auth0 sub as the openId (unique user identifier)
      const openId = userInfo.sub;
      const email = userInfo.email || null;
      const name = userInfo.name || userInfo.nickname || null;
      const avatarUrl = userInfo.picture || null;

      // Determine login method from Auth0 sub prefix
      let loginMethod = "auth0";
      if (openId.startsWith("google-oauth2|")) loginMethod = "google";
      else if (openId.startsWith("github|")) loginMethod = "github";
      else if (openId.startsWith("apple|")) loginMethod = "apple";
      else if (openId.startsWith("windowslive|") || openId.startsWith("waad|")) loginMethod = "microsoft";
      else if (openId.startsWith("auth0|")) loginMethod = "email";

      // Check if user exists by email first (for linking pre-created accounts)
      let existingUser = await db.getUserByOpenId(openId);

      if (!existingUser && email) {
        const userByEmail = await db.getUserByEmail(email);
        if (userByEmail) {
          // Link existing user with Auth0 openId
          console.log(`[Auth0] Linking existing user ${email} with Auth0 sub ${openId}`);
          await db.linkUserOpenId(userByEmail.id, openId);
          existingUser = await db.getUserByOpenId(openId);
        }
      }

      // Upsert user in database
      await db.upsertUser({
        openId,
        name,
        email,
        loginMethod,
        avatarUrl,
        lastSignedIn: new Date(),
      });

      // Create session token (same JWT mechanism as before)
      const sessionToken = await sdk.createSessionToken(openId, {
        name: name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      if (isMobile) {
        console.log(`[Auth0] Mobile callback success → redirecting to native app`);
        const deepLink = `com.greenhproject.evgreen://home?token=${encodeURIComponent(sessionToken)}`;
        // Chrome Custom Tab on Android 13+ blocks 302 redirects to custom URL schemes.
        // A JS window.location assignment is not blocked and fires the Android intent correctly.
        // iOS SFSafariViewController handles both methods.
        res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><script>window.location.href=${JSON.stringify(deepLink)};</script></head><body></body></html>`);
      } else {
        res.redirect(302, "/");
      }
    } catch (error) {
      console.error("[Auth0] Callback failed:", error);
      res.redirect("/?auth_error=callback_failed");
    }
  });

  // Mobile token exchange: WKWebView calls this after receiving the deep-link token
  // to set the session cookie in the WKWebView cookie store
  app.post("/api/auth/mobile-token", (req: Request, res: Response) => {
    const token = req.body?.token;
    if (!token || typeof token !== "string") {
      res.status(400).json({ error: "Missing token" });
      return;
    }
    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
    res.json({ ok: true });
  });

  // Logout route
  app.get("/api/auth/logout", (req: Request, res: Response) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });

    // Redirect to Auth0 logout to clear Auth0 session too
    const origin = getOrigin(req);
    const returnTo = encodeURIComponent(origin);

    if (AUTH0_DOMAIN && AUTH0_CLIENT_ID) {
      res.redirect(`https://${AUTH0_DOMAIN}/v2/logout?client_id=${AUTH0_CLIENT_ID}&returnTo=${returnTo}`);
    } else {
      res.redirect("/");
    }
  });

  // Keep the old OAuth callback for backward compatibility (redirect to new login)
  app.get("/api/oauth/callback", (_req: Request, res: Response) => {
    res.redirect("/api/auth/login");
  });
}

export async function deleteAuth0User(openId: string): Promise<void> {
  if (!AUTH0_DOMAIN || !AUTH0_CLIENT_ID || !AUTH0_CLIENT_SECRET) {
    console.warn("[Auth0] Cannot delete user from Auth0: missing config");
    return;
  }

  try {
    const tokenRes = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: AUTH0_CLIENT_ID,
        client_secret: AUTH0_CLIENT_SECRET,
        audience: `https://${AUTH0_DOMAIN}/api/v2/`,
        grant_type: "client_credentials",
      }),
    });

    if (!tokenRes.ok) {
      console.error("[Auth0] Management API token failed:", await tokenRes.text());
      return;
    }

    const { access_token } = await tokenRes.json() as { access_token: string };

    const deleteRes = await fetch(
      `https://${AUTH0_DOMAIN}/api/v2/users/${encodeURIComponent(openId)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${access_token}` },
      }
    );

    if (!deleteRes.ok && deleteRes.status !== 404) {
      console.error("[Auth0] Delete user failed:", deleteRes.status, await deleteRes.text());
    } else {
      console.log(`[Auth0] User deleted from Auth0: ${openId}`);
    }
  } catch (e) {
    console.error("[Auth0] deleteAuth0User error:", e);
  }
}
