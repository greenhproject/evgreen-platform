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
const AUTH0_MOBILE_CLIENT_ID = ENV.auth0MobileClientId;

let auth0Client: any = null;
let auth0MobileClient: any = null;

// Short-lived server-side store for mobile auth tokens.
// The app generates a random sk before opening the CCT, the server stores the
// session token here after a successful OAuth callback, and the app claims it
// via GET /api/auth/claim once the CCT closes — no deep link required.
const pendingTokens = new Map<string, { token: string; expires: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of pendingTokens) {
    if (v.expires < now) pendingTokens.delete(k);
  }
}, 60_000);

async function getAuth0Client(mobile = false) {
  if (mobile) {
    if (auth0MobileClient) return auth0MobileClient;
    const clientId = AUTH0_MOBILE_CLIENT_ID || AUTH0_CLIENT_ID;
    if (!AUTH0_DOMAIN || !clientId) {
      console.error("[Auth0] Missing mobile configuration");
      return null;
    }
    try {
      const issuer = await Issuer.discover(`https://${AUTH0_DOMAIN}`);
      // Native apps in Auth0 are public clients (token_endpoint_auth_method: none)
      // No client_secret is used or required for the code exchange
      auth0MobileClient = new issuer.Client({
        client_id: clientId,
        token_endpoint_auth_method: "none",
        redirect_uris: [],
        response_types: ["code"],
      });
      console.log("[Auth0] Mobile client initialized | clientId:", clientId.substring(0, 8) + "...");
      return auth0MobileClient;
    } catch (error) {
      console.error("[Auth0] Failed to initialize mobile client:", error);
      return null;
    }
  }

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
getAuth0Client(true).catch(console.error);

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
      const isMobilePlatform = req.query.platform === "mobile";
      const client = await getAuth0Client(isMobilePlatform);
      if (!client) {
        res.status(500).json({ error: "Auth0 not configured" });
        return;
      }

      const origin = getOrigin(req);
      const redirectUri = `${origin}/api/auth/callback`;

      // Encode mobile flag directly in state so it survives the OAuth redirect chain
      // without relying on cookies (which can be partitioned or blocked in Chrome CCT).
      const nonce = generators.state();
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

      // Store the session key (sk) sent by the native app so the callback can
      // associate the completed auth with the pending token store.
      const sk = typeof req.query.sk === "string" ? req.query.sk : null;
      if (sk) {
        res.cookie("auth0_sk", sk, {
          httpOnly: true,
          secure: isSecure,
          sameSite: isSecure ? "none" : "lax",
          maxAge: 5 * 60 * 1000,
          path: "/",
        });
      }

      const authUrl = client.authorizationUrl({
        scope: "openid profile email",
        redirect_uri: redirectUri,
        state,
        prompt: "login", // Force login screen (no auto-login with cached session)
      });

      console.log(`[Auth0] Redirecting to Auth0 | mobile=${isMobilePlatform} | state_suffix=${state.slice(-4)} | redirect_uri=${redirectUri}`);
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
      console.log(`[Auth0] Callback state | isMobile=${isMobile} | storedState=${storedState ? 'present' : 'MISSING'} | incomingState_suffix=${incomingState.slice(-4)}`);

      // Use mobile client for mobile callbacks so the client_id matches the one used in login
      const callbackClient = isMobile ? await getAuth0Client(true) : client;
      const tokenSet = await callbackClient.callback(redirectUri, params, {
        state: storedState,
      });

      // Clear state and legacy mobile cookies
      const sk = req.cookies?.auth0_sk || null;
      res.clearCookie("auth0_state", { path: "/" });
      res.clearCookie("auth0_mobile", { path: "/" });
      res.clearCookie("auth0_sk", { path: "/" });

      // Get user info from Auth0
      const userInfo = await callbackClient.userinfo(tokenSet.access_token!);

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
      console.log(`[Auth0] Session token created | user=${email || openId.substring(0, 20)} | method=${loginMethod}`);

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      if (isMobile) {
        const ua = req.headers['user-agent'] || '';
        const isAndroid = /Android/i.test(ua);

        // Store token as fallback in case the OS-level redirect below doesn't reach
        // the app (e.g. no registered intent filter found). The app claims it via
        // GET /api/auth/claim?sk=... when browserFinished fires.
        if (sk) {
          pendingTokens.set(sk, { token: sessionToken, expires: Date.now() + 5 * 60_000 });
        }
        console.log(`[Auth0] Mobile callback OK | platform=${isAndroid ? 'android' : 'ios'} | sk=${sk ? sk.substring(0, 8) + '...' : 'none'}`);

        // HTTP 302 redirect to the app's custom scheme. Unlike JavaScript-initiated
        // navigation (blocked by Chrome 83+), a server-side redirect is handled by
        // the OS: Chrome CCT forwards it as an intent, the app opens and appUrlOpen fires.
        res.redirect(302, `com.greenhproject.evgreen://callback?token=${encodeURIComponent(sessionToken)}`);
      } else {
        res.redirect(302, "/");
      }
    } catch (error) {
      console.error("[Auth0] Callback failed:", error);
      res.redirect("/?auth_error=callback_failed");
    }
  });

  // Native app claims the session token after the CCT closes (browserFinished).
  // The app generates a random sk before opening the CCT; the server stores the
  // token here after a successful OAuth callback; the app retrieves it once.
  app.get("/api/auth/claim", (req: Request, res: Response) => {
    const sk = typeof req.query.sk === "string" ? req.query.sk : null;
    if (!sk) {
      res.status(400).json({ error: "Missing sk" });
      return;
    }
    const entry = pendingTokens.get(sk);
    if (!entry || entry.expires < Date.now()) {
      pendingTokens.delete(sk);
      res.status(404).json({ error: "No pending token" });
      return;
    }
    const { token } = entry;
    pendingTokens.delete(sk); // single-use
    console.log(`[Auth0] Token claimed | sk=${sk.substring(0, 8)}...`);
    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
    res.json({ token });
  });

  // Mobile token exchange: app calls this after receiving the deep-link token
  // to set the session cookie in the WebView cookie store
  app.post("/api/auth/mobile-token", (req: Request, res: Response) => {
    const token = req.body?.token;
    if (!token || typeof token !== "string") {
      res.status(400).json({ error: "Missing token" });
      return;
    }
    console.log(`[Auth0] mobile-token exchange received | token_prefix=${token.substring(0, 10)}`);
    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
    res.json({ ok: true });
  });

  // Logout route
  app.get("/api/auth/logout", (req: Request, res: Response) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, cookieOptions);

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
