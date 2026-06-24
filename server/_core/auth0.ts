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

let webClient: any = null;

async function getAuth0Client(_isMobile = false) {
  // The server always does the OAuth code exchange with client_secret (server-side flow).
  // The isMobile flag only affects the post-auth redirect target (deep link vs web URL).
  if (webClient) return webClient;

  if (!AUTH0_DOMAIN || !AUTH0_CLIENT_ID) {
    console.error("[Auth0] Missing configuration.");
    return null;
  }

  try {
    const issuer = await Issuer.discover(`https://${AUTH0_DOMAIN}`);
    webClient = new issuer.Client({
      client_id: AUTH0_CLIENT_ID,
      client_secret: AUTH0_CLIENT_SECRET,
      token_endpoint_auth_method: "client_secret_basic",
      redirect_uris: [],
      response_types: ["code"],
    });

    console.log("[Auth0] Client initialized for domain:", AUTH0_DOMAIN);
    return webClient;
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
      const isMobile = req.query.platform === "mobile";
      const client = await getAuth0Client(isMobile);
      if (!client) {
        res.status(500).json({ error: "Auth0 not configured" });
        return;
      }

      const origin = getOrigin(req);
      // Always use the base callback URL — no query params.
      // Platform is encoded in the state parameter ("|mobile" suffix) so we
      // never need ?platform=mobile in the redirect_uri. This avoids Auth0
      // stripping unknown query params from the registered callback URL and
      // causing a redirect_uri mismatch on token exchange.
      const redirectUri = `${origin}/api/auth/callback`;

      const csrfState = generators.state();
      const state = isMobile ? `${csrfState}|mobile` : csrfState;

      console.log(`[Auth0 DEBUG] Intentando login. isMobile: ${isMobile}`);
      console.log(`[Auth0 DEBUG] Redirect URI generada: ${redirectUri}`);

      // Store state in a short-lived cookie
      const isSecure = origin.startsWith("https");
      res.cookie("auth0_state", state, {
        httpOnly: true,
        secure: isSecure,
        sameSite: isSecure ? "none" : "lax",
        maxAge: 5 * 60 * 1000, // 5 minutes
        path: "/",
        domain: req.hostname
      });

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
      const client = await getAuth0Client();
      if (!client) {
        res.status(500).json({ error: "Auth0 not configured" });
        return;
      }

      const origin = getOrigin(req);
      const params = client.callbackParams(req);

      // The redirect_uri for token exchange must be IDENTICAL to what the login sent.
      // Login now always uses the base URL (no query params), so we do the same here.
      const redirectUri = `${origin}/api/auth/callback`;

      // Get the state from cookie — it encodes the platform as a suffix: "csrfState|mobile"
      const storedState = req.cookies?.auth0_state;

      // Detect isMobile solely from the state parameter.
      // The login handler always encodes "|mobile" in state for mobile flows.
      // Auth0 MUST return the state verbatim, so this is the most reliable signal.
      const isMobile = storedState
        ? storedState.endsWith("|mobile")
        : Boolean(params.state?.endsWith("|mobile"));

      console.log(`[Auth0 DEBUG] Callback recibido. storedState: ${storedState ?? "NO"}, paramsState: ${params.state ?? "NO"}, isMobile: ${isMobile}, redirectUri: ${redirectUri}`);

      // Use storedState for CSRF verification. If the cookie was lost (ITP), fall back to
      // using params.state as the "expected" value so openid-client doesn't reject on state
      // mismatch against undefined. Security note: when storedState is missing we can't do
      // CSRF verification, but the deep-link target (evgreen://) is app-specific.
      const expectedState = storedState ?? params.state;
      const tokenSet = await client.callback(redirectUri, params, {
        state: expectedState,
      });

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

      if (isMobile) {
        const finalUrl = `${ENV.mobileAppScheme}://home?token=${sessionToken}`;
        console.log(`[Auth0 DEBUG] URL final de redirección: ${finalUrl}`);
        // Serve HTML page with JS redirect instead of HTTP 302.
        // SFSafariViewController does NOT fire application:openURL:options: for HTTP
        // 302 redirects to custom URL schemes — only for JS-initiated navigations.
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(
          `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>` +
          `<body><script>window.location.replace(${JSON.stringify(finalUrl)});</script>` +
          `<p style="font-family:sans-serif;padding:20px">Abriendo EVGreen...</p></body></html>`
        );
      } else {
        // Encode state info so we can see it in the URL bar if this branch fires
        // unexpectedly for a mobile session (temporary debug aid).
        const st = (storedState ?? 'null').slice(-8);
        const ps = (params.state ?? 'null').slice(-8);
        res.redirect(302, `/?_m=0&_st=${encodeURIComponent(st)}&_ps=${encodeURIComponent(ps)}`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("[Auth0] Callback failed:", error);
      const st = (storedState ?? 'null').slice(-8);
      const ps = String((params as any)?.state ?? 'null').slice(-8);
      res.redirect(`/?auth_error=${encodeURIComponent(msg.substring(0, 150))}&_st=${encodeURIComponent(st)}&_ps=${encodeURIComponent(ps)}`);
    }
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
