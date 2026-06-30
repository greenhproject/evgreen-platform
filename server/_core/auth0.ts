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
const AUTH0_MOBILE_CLIENT_ID = ENV.auth0MobileClientId;
const AUTH0_CLIENT_SECRET = ENV.auth0ClientSecret;

let webClient: any = null;
let mobileClient: any = null;

async function getAuth0Client(isMobile = false) {
  if (isMobile && mobileClient) return mobileClient;
  if (!isMobile && webClient) return webClient;

  const clientId = isMobile ? AUTH0_MOBILE_CLIENT_ID : AUTH0_CLIENT_ID;

  if (!AUTH0_DOMAIN || !clientId) {
    console.error(`[Auth0] Missing configuration for ${isMobile ? "mobile" : "web"}.`);
    return null;
  }

  try {
    const issuer = await Issuer.discover(`https://${AUTH0_DOMAIN}`);
    const client = new issuer.Client({
      client_id: clientId,
      client_secret: isMobile ? undefined : AUTH0_CLIENT_SECRET,
      token_endpoint_auth_method: isMobile ? "none" : "client_secret_basic",
      redirect_uris: [],
      response_types: ["code"],
    });

    if (isMobile) mobileClient = client;
    else webClient = client;

    console.log(`[Auth0] ${isMobile ? "Mobile" : "Web"} client initialized for domain:`, AUTH0_DOMAIN);
    return client;
  } catch (error) {
    console.error(`[Auth0] Failed to initialize ${isMobile ? "mobile" : "web"} client:`, error);
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
      const isMobile = req.query.platform === "mobile";
      const client = await getAuth0Client(isMobile);
      if (!client) {
        res.status(500).json({ error: "Auth0 not configured" });
        return;
      }

      const origin = getOrigin(req);
      const redirectUri = `${origin}/api/auth/callback${isMobile ? "?platform=mobile" : ""}`;

      console.log(`[Auth0 DEBUG] Intentando login. isMobile: ${isMobile}`);
      console.log(`[Auth0 DEBUG] Redirect URI generada: ${redirectUri}`);
      console.log(`[Auth0 DEBUG] Client ID usado: ${isMobile ? AUTH0_MOBILE_CLIENT_ID : AUTH0_CLIENT_ID}`);

      // Generate state for CSRF protection
      const state = generators.state();

      // Store state in a short-lived cookie
      const isSecure = origin.startsWith("https");
      res.cookie("auth0_state", state, {
        httpOnly: true,
        secure: isSecure,
        sameSite: isSecure ? "none" : "lax",
        maxAge: 5 * 60 * 1000, // 5 minutes
        path: "/",
        domain: req.hostname // Asegura que la cookie se asocie al host actual
      });

      // Track mobile logins so callback can redirect to the native app
      if (req.query.platform === "mobile") {
        res.cookie("auth0_mobile", "1", {
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
        prompt: "login",
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
      const isMobile = req.query.platform === "mobile";
      const client = await getAuth0Client(isMobile);
      if (!client) {
        res.status(500).json({ error: "Auth0 not configured" });
        return;
      }

      const origin = getOrigin(req);
      const redirectUri = `${origin}/api/auth/callback${isMobile ? "?platform=mobile" : ""}`;

      // Get the state from cookie
      const storedState = req.cookies?.auth0_state;

      console.log(`[Auth0 DEBUG] Callback recibido. State en cookie: ${storedState ? "SÍ" : "NO"}`);
      const params = client.callbackParams(req);
      console.log(`[Auth0 DEBUG] State en URL: ${params.state ? "SÍ" : "NO"}`);

      let tokenSet;
      try {
        tokenSet = await client.callback(redirectUri, params, {
          state: storedState,
        });
      } catch (err) {
        console.error("[Auth0 DEBUG] Error en client.callback:", err);
        // En desarrollo, si falla el state, intentamos procesar sin él
        if (process.env.NODE_ENV === "development") {
          console.warn("[Auth0 DEBUG] Reintentando validación sin verificar state (solo dev)");
          tokenSet = await client.callback(redirectUri, params);
        } else {
          throw err;
        }
      }

      // Clear the state cookie
      res.clearCookie("auth0_state", { path: "/" });

      // Get user info from Auth0
      const userInfo = await client.userinfo(tokenSet.access_token!);
      console.log(`[Auth0 DEBUG] UserInfo obtenido para: ${userInfo.email}`);

      if (!userInfo.sub) {
        res.status(400).json({ error: "No user identifier from Auth0" });
        return;
      }

      // ... (código intermedio de loginMethod y db)
      const openId = userInfo.sub;
      const email = userInfo.email || null;
      const name = userInfo.name || userInfo.nickname || null;
      const avatarUrl = userInfo.picture || null;

      let loginMethod = "auth0";
      if (openId.startsWith("google-oauth2|")) loginMethod = "google";
      // ... rest of logic ...

      await db.upsertUser({
        openId,
        name,
        email,
        loginMethod,
        avatarUrl,
        lastSignedIn: new Date(),
      });

      // Create session token
      const sessionToken = await sdk.createSessionToken(openId, {
        name: name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      console.log(`[Auth0 DEBUG] Sesión creada. Redirigiendo a móvil: ${isMobile}`);

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.clearCookie("auth0_mobile", { path: "/" });

      if (isMobile) {
        const finalUrl = `${ENV.mobileAppScheme}://home?token=${sessionToken}`;
        console.log(`[Auth0 DEBUG] URL final de redirección: ${finalUrl}`);
        res.redirect(302, finalUrl);
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

/**
 * Delete a user from Auth0 using the Management API.
 * Called after deleting the user from our own database.
 * Errors are logged but do not block the local deletion.
 */
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
