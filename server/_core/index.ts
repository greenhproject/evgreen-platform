import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import path from "path";
import fs from "fs";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerAuth0Routes } from "./auth0";
import cookieParser from "cookie-parser";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { WebSocketServer, WebSocket } from "ws";
import { handleWompiWebhook } from "../wompi/webhook";
import { startBillingCronJob } from "../wompi/recurring-billing";
import { startReconciliationCron } from "../wompi/reconciliation-cron";
import { startTransactionCleanupJob } from "../jobs/transaction-cleanup";
import { startBalanceMonitor } from "../charging/balance-monitor";
import { startProactiveNotifications } from "../ai/proactive-notifications";
import { startDemandForecastJob } from "../ai/demand-forecast-service";
import { startOverstayMonitor, onChargingFinished, onCableDisconnected } from "../charging/overstay-monitor";
import { reservationJobs } from "../notifications/reservation-notifications";
import * as ocppManager from "../ocpp/connection-manager";
import * as alertsService from "../ocpp/alerts-service";
import { dualCSMS } from "../ocpp/csms-dual";

// Grace period para desconexiones temporales del legacy CSMS
// Evita notificaciones por reconexiones intermitentes (WiFi inestable, reinicios breves)
const LEGACY_DISCONNECT_GRACE_MS = 5 * 60 * 1000; // 5 minutos
const legacyDisconnectGrace = new Map<string, NodeJS.Timeout>();

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  
  // CRÍTICO: server.timeout DEBE ser 0 para permitir conexiones WebSocket OCPP de larga duración.
  // El timeout del servidor HTTP de Node.js aplica a TODAS las conexiones, incluyendo WebSocket.
  // Si se establece un timeout > 0, Node.js cierra las conexiones WebSocket OCPP después de ese tiempo,
  // causando desconexiones del cargador. Esto se rompió el 11 de marzo cuando se cambió de 0 a 120s.
  // Los timeouts de requests HTTP normales se manejan a nivel de middleware (rate limiter, express).
  server.timeout = 0; // Sin timeout - REQUERIDO para WebSocket OCPP de larga duración
  server.keepAliveTimeout = 0; // Sin timeout de keep-alive - REQUERIDO para OCPP
  server.headersTimeout = 0; // Sin timeout de headers
  server.requestTimeout = 0; // Sin timeout de request
  
  // ============================================
  // SECURITY HEADERS - Aplicar a todas las respuestas
  // ============================================
  app.use((_req, res, next) => {
    // Prevenir clickjacking
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    // Prevenir MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Prevenir XSS reflejado (navegadores legacy)
    res.setHeader('X-XSS-Protection', '1; mode=block');
    // Referrer policy - no enviar referrer a terceros
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // Permissions policy - restringir APIs del navegador
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=(self), payment=(self)');
    // HSTS - forzar HTTPS (1 año)
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    // Remover header que expone tecnología del servidor
    res.removeHeader('X-Powered-By');
    next();
  });

  // ============================================
  // RATE LIMITING para API endpoints (protección contra brute force)
  // ============================================
  const apiRateLimits = new Map<string, { count: number; resetTime: number }>();
  
  // SEGURIDAD: Rate limit separado para webhook/OCPP (más permisivo pero existente)
  const webhookRateLimits = new Map<string, { count: number; resetTime: number }>();
  app.use('/api/', (req, res, next) => {
    if (req.path.includes('/webhook') || req.path.includes('/ocpp')) {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      const key = `wh:${ip}`;
      const now = Date.now();
      const windowMs = 60000; // 1 minuto
      const maxRequests = 600; // 600 req/min para webhook/OCPP (operacional pero con límite)
      
      const entry = webhookRateLimits.get(key);
      if (!entry || now > entry.resetTime) {
        webhookRateLimits.set(key, { count: 1, resetTime: now + windowMs });
      } else {
        entry.count++;
        if (entry.count > maxRequests) {
          console.warn(`[Security] Rate limit exceeded for webhook/OCPP from IP: ${ip}`);
          res.status(429).json({ error: 'Too many requests' });
          return;
        }
      }
      return next();
    }
    
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${ip}:${req.path}`;
    const now = Date.now();
    const windowMs = 60000; // 1 minuto
    const maxRequests = 120; // 120 requests por minuto por IP+path
    
    const entry = apiRateLimits.get(key);
    if (!entry || now > entry.resetTime) {
      apiRateLimits.set(key, { count: 1, resetTime: now + windowMs });
    } else {
      entry.count++;
      if (entry.count > maxRequests) {
        res.status(429).json({ error: 'Too many requests. Please try again later.' });
        return;
      }
    }
    
    next();
  });

  // Limpiar rate limits de forma determinista cada 5 minutos (evita memory leak)
  setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    for (const [k, v] of Array.from(apiRateLimits.entries())) {
      if (now > v.resetTime) {
        apiRateLimits.delete(k);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      console.log(`[RateLimit] Cleaned ${cleaned} expired entries, ${apiRateLimits.size} remaining`);
    }
  }, 5 * 60 * 1000);

  // Cookie parser (needed for Auth0 state cookie)
  app.use(cookieParser());
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // Wompi webhook
  app.post("/api/wompi/webhook", express.json(), handleWompiWebhook);

  // Wompi native redirect relay: Chrome Custom Tab bloquea 302 a custom schemes,
  // pero SÍ permite window.location.href desde JavaScript.
  app.get("/api/wompi/redirect", (req, res) => {
    const { reference, platform } = req.query as { reference?: string; platform?: string };
    if (!reference || typeof reference !== "string" || !/^[A-Z0-9_\-]+$/i.test(reference)) {
      return res.status(400).send("Missing or invalid reference");
    }
    if (platform === "native") {
      const safeRef = encodeURIComponent(reference);
      const deepLink = `com.greenhproject.evgreen://wallet?payment=wompi&reference=${safeRef}`;
      const fallback = `https://app.evgreen.lat/wallet?payment=wompi&reference=${safeRef}`;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Regresando a EVGreen...</title>
  <style>body{background:#052E16;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center}</style>
</head>
<body>
  <div><p style="font-size:1.2rem">Regresando a la app EVGreen...</p></div>
  <script>
    window.location.href = '${deepLink}';
    setTimeout(function() { window.location.replace('${fallback}'); }, 2000);
  </script>
</body>
</html>`);
    } else {
      res.redirect(302, `https://app.evgreen.lat/wallet?payment=wompi&reference=${encodeURIComponent(reference)}`);
    }
  });

  // API Pública REST v1 para integración externa
  const { default: publicApiRouter } = await import("../api/public-api");
  app.use("/api/v1", express.json(), publicApiRouter);

  // Página de documentación de API
  app.get("/api-docs", (_req, res) => {
    const currentDir = path.dirname(new URL(import.meta.url).pathname);
    res.sendFile("api-docs.html", { root: path.join(currentDir, "../../client/public") });
  });
  
  // Diagnóstico: log inmediato de TODAS las peticiones a /api/auth/* para confirmar si llegan al servidor
  app.use('/api/auth', (req, _res, next) => {
    console.log(`[Auth RECV] ${req.method} /api/auth${req.path} | platform=${req.query.platform ?? 'none'} | UA=${req.headers['user-agent']?.slice(0, 60) ?? 'unknown'}`);
    next();
  });

  // Auth0 authentication routes
  registerAuth0Routes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // ============================================
  // HEALTH CHECK ENDPOINT - Monitoreo de estado del servidor
  // ============================================
  app.get("/api/health", async (_req, res) => {
    try {
      const { getPoolStats } = await import("../db");
      const poolStats = getPoolStats();
      let dbOk = false;
      try {
        const { getDb } = await import("../db");
        const db = await getDb();
        if (db) {
          await (db as any).execute('SELECT 1');
          dbOk = true;
        }
      } catch { dbOk = false; }
      const mem = process.memoryUsage();
      res.json({
        status: dbOk ? 'healthy' : 'degraded',
        uptime: Math.floor(process.uptime()),
        database: { connected: dbOk, pool: poolStats },
        memory: {
          rss: Math.round(mem.rss / 1024 / 1024) + 'MB',
          heapUsed: Math.round(mem.heapUsed / 1024 / 1024) + 'MB',
          heapTotal: Math.round(mem.heapTotal / 1024 / 1024) + 'MB',
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({ status: 'error', error: error.message });
    }
  });

  // Endpoint de verificación OCPP (HTTP) - bajo /api/ para que funcione en producción
  app.get("/api/ocpp/status", (req, res) => {
    const host = req.headers.host || "localhost:3000";
    res.json({
      status: "online",
      buildVersion: "v2026.02.18.B",
      message: "OCPP WebSocket server is running",
      endpoints: {
        primary: `wss://${host}/ocpp/{chargePointId}`,
        alternative: `wss://${host}/api/ocpp/ws/{chargePointId}`,
      },
      supportedProtocols: ["ocpp1.6", "ocpp2.0.1"],
      timestamp: new Date().toISOString(),
      note: "If primary endpoint fails with error 1006, try the alternative endpoint under /api/"
    });
  });

  // Endpoint de prueba WebSocket simple (para diagnóstico)
  app.get("/api/ocpp/test", (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>OCPP WebSocket Test</title></head>
      <body>
        <h1>OCPP WebSocket Test</h1>
        <div id="status">Connecting...</div>
        <div id="log" style="white-space: pre-wrap; font-family: monospace;"></div>
        <script>
          const log = document.getElementById('log');
          const status = document.getElementById('status');
          const host = window.location.host;
          
          function addLog(msg) {
            log.textContent += new Date().toISOString() + ': ' + msg + '\\n';
          }
          
          // Probar endpoint primario
          addLog('Testing primary endpoint: wss://' + host + '/ocpp/TEST001');
          const ws1 = new WebSocket('wss://' + host + '/ocpp/TEST001', ['ocpp1.6']);
          ws1.onopen = () => { addLog('PRIMARY: Connected!'); status.textContent = 'Primary endpoint works!'; };
          ws1.onerror = (e) => { addLog('PRIMARY: Error - ' + e.type); };
          ws1.onclose = (e) => { 
            addLog('PRIMARY: Closed - code=' + e.code + ', reason=' + e.reason);
            if (e.code === 1006) {
              addLog('Trying alternative endpoint...');
              const ws2 = new WebSocket('wss://' + host + '/api/ocpp/ws/TEST001', ['ocpp1.6']);
              ws2.onopen = () => { addLog('ALTERNATIVE: Connected!'); status.textContent = 'Alternative endpoint works!'; };
              ws2.onerror = (e) => { addLog('ALTERNATIVE: Error - ' + e.type); };
              ws2.onclose = (e) => { addLog('ALTERNATIVE: Closed - code=' + e.code + ', reason=' + e.reason); };
            }
          };
        </script>
      </body>
      </html>
    `);
  });

  // Servir archivos críticos del Service Worker ANTES de Vite/static
  // Esto garantiza que sw.js, manifest.json y offline.html siempre estén disponibles
  // incluso a través de proxies (Cloudflare, Manus) que podrían interceptar las peticiones
  // En producción (Docker): import.meta.dirname = /app/dist, archivos en /app/dist/public
  // En desarrollo: import.meta.dirname = server/_core, archivos en client/public
  const publicDir = process.env.NODE_ENV === "development"
    ? path.resolve(import.meta.dirname, "../..", "client", "public")
    : path.resolve(import.meta.dirname, "public");
  
  app.get("/sw.js", (_req, res) => {
    const swPath = path.resolve(publicDir, "sw.js");
    if (fs.existsSync(swPath)) {
      res.setHeader("Content-Type", "application/javascript");
      res.setHeader("Service-Worker-Allowed", "/");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.sendFile(swPath);
    } else {
      res.status(404).send("Service Worker not found");
    }
  });
  
  app.get("/manifest.json", (_req, res) => {
    const manifestPath = path.resolve(publicDir, "manifest.json");
    if (fs.existsSync(manifestPath)) {
      res.setHeader("Content-Type", "application/manifest+json");
      res.sendFile(manifestPath);
    } else {
      res.status(404).send("Manifest not found");
    }
  });
  
  app.get("/offline.html", (_req, res) => {
    const offlinePath = path.resolve(publicDir, "offline.html");
    if (fs.existsSync(offlinePath)) {
      res.sendFile(offlinePath);
    } else {
      res.status(200).send("<html><body><h1>Sin conexión</h1><p>Vuelve a intentar cuando tengas conexión.</p></body></html>");
    }
  });

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  // Crear servidor WebSocket para OCPP en el mismo puerto HTTP
  // No usar path fijo para permitir subrutas como /ocpp/CP001
  const wss = new WebSocketServer({ 
    noServer: true,
    // Aumentar timeout para conexiones OCPP
    clientTracking: true,
    perMessageDeflate: false, // Desactivar compresión para mejor compatibilidad
    handleProtocols: (protocols: Set<string>) => {
      console.log(`[OCPP] Client requested protocols:`, Array.from(protocols));
      // Priorizar OCPP 2.0.1, pero aceptar 1.6J si es lo único disponible
      if (protocols.has("ocpp2.0.1")) return "ocpp2.0.1";
      if (protocols.has("ocpp2.0")) return "ocpp2.0";
      if (protocols.has("ocpp1.6")) return "ocpp1.6";
      // Si no se especifica protocolo, aceptar conexión de todos modos
      return protocols.size > 0 ? Array.from(protocols)[0] : "ocpp1.6";
    }
  });

  // Registrar el WSS principal en dualCSMS para auto-recovery de conexiones
  dualCSMS.setMainWss(wss);

  // ============================================================================
  // ESTRATEGIA ANTI-PROXY-TIMEOUT (3 capas)
  // ============================================================================
  // El proxy externo (Manus/Railway/Nginx) tiene un timeout de ~180s para WebSocket.
  // Los frames de control (ping/pong) NO resetean este timeout en muchos proxies.
  // Necesitamos enviar DATOS REALES por el WebSocket para resetear el proxy_read_timeout.
  //
  // Capa 1: WebSocket ping/pong (cada 20s) - mantiene el protocolo WS vivo
  // Capa 2: OCPP TriggerMessage Heartbeat (cada 90s) - genera tráfico de datos bidireccional
  // Capa 3: OCPP ChangeConfiguration HeartbeatInterval=30 - el cargador envía heartbeats frecuentes
  // ============================================================================

  // CAPA 1: WebSocket ping/pong con tolerancia a retrasos del event loop
  // PROBLEMA RESUELTO: El sistema anterior usaba un flag booleano isAlive que se
  // reseteaba a false cada 20s. Si el event loop se retrasaba (GC, query pesada),
  // TODOS los cargadores tenían isAlive=false simultáneamente y se terminaban al
  // mismo tiempo. Ahora usamos un contador de pongs perdidos con 3 reintentos.
  const WS_PING_INTERVAL_MS = 20000; // 20 segundos - alineado con DualCSMS (PING_INTERVAL_MS=20000)
  const MAX_MISSED_PONGS = 3; // Permitir hasta 3 pings sin respuesta antes de terminar (75s total)
  let pingCount = 0;
  const pingInterval = setInterval(() => {
    const clientCount = wss.clients.size;
    if (clientCount > 0) {
      pingCount++;
      if (pingCount % 12 === 0) {
        console.log(`[OCPP] Ping keepalive #${pingCount} - ${clientCount} client(s) connected`);
      }
    }
    const now = Date.now();
    wss.clients.forEach((ws) => {
      const identity = (ws as any)._ocppIdentity || 'unknown';
      const missedPongs: number = (ws as any)._missedPongs || 0;
      const lastActivity: number = (ws as any)._lastActivity || (ws as any)._connectedAt || now;
      
      // Si el cargador ha enviado CUALQUIER dato recientemente (heartbeat, meter values, etc.)
      // resetear el contador de missed pongs — la conexión está viva
      const timeSinceActivity = now - lastActivity;
      if (timeSinceActivity < WS_PING_INTERVAL_MS * 2) {
        // Actividad reciente detectada, resetear contador
        (ws as any)._missedPongs = 0;
      } else if (missedPongs >= MAX_MISSED_PONGS) {
        // 3 pings consecutivos sin respuesta Y sin actividad de datos → conexión muerta
        const totalSilence = Math.round(timeSinceActivity / 1000);
        console.log(`[OCPP] Terminating dead connection: ${identity} (${missedPongs} missed pongs, ${totalSilence}s since last activity)`);
        (ws as any)._missedPongs = 0; // Reset para evitar doble-terminate
        return ws.terminate();
      }
      
      // Incrementar contador y enviar ping
      (ws as any)._missedPongs = missedPongs + 1;
      try {
        ws.ping();
      } catch (err) {
        console.error(`[OCPP] Error sending ping to ${identity}:`, err);
      }
    });
  }, WS_PING_INTERVAL_MS);

  // CAPA 2: Enviar TriggerMessage(Heartbeat) OCPP cada 90s para generar tráfico de DATOS reales
  // Esto es un mensaje OCPP real [2, "keepalive-xxx", "TriggerMessage", {"requestedMessage": "Heartbeat"}]
  // que genera una respuesta del cargador, reseteando el proxy_read_timeout
  const OCPP_KEEPALIVE_INTERVAL_MS = 90000; // 90 segundos (bien por debajo de los 180s del proxy)
  let keepaliveCount = 0;
  const ocppKeepaliveInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.readyState !== 1) return; // Solo OPEN
      const identity = (ws as any)._ocppIdentity || 'unknown';
      keepaliveCount++;
      
      try {
        // Enviar TriggerMessage para solicitar un Heartbeat del cargador
        // Esto genera tráfico bidireccional real (datos, no control frames)
        const messageId = `keepalive-${Date.now()}-${keepaliveCount}`;
        const triggerMsg = JSON.stringify([2, messageId, "TriggerMessage", { requestedMessage: "Heartbeat" }]);
        ws.send(triggerMsg);
        
        if (keepaliveCount % 10 === 0) {
          console.log(`[OCPP] Keepalive TriggerMessage #${keepaliveCount} sent to ${identity}`);
        }
      } catch (err) {
        console.error(`[OCPP] Error sending keepalive TriggerMessage to ${identity}:`, err);
      }
    });
  }, OCPP_KEEPALIVE_INTERVAL_MS);

  wss.on("close", () => {
    clearInterval(pingInterval);
    clearInterval(ocppKeepaliveInterval);
  });

  // Manejar upgrade de HTTP a WebSocket para rutas OCPP
  // Soportar tanto /ocpp/ como /api/ocpp/ para compatibilidad con diferentes proxies
  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url || "", `http://${request.headers.host}`);
    
    console.log(`[OCPP] Upgrade request received:`, {
      path: url.pathname,
      headers: {
        upgrade: request.headers.upgrade,
        connection: request.headers.connection,
        secWebSocketProtocol: request.headers["sec-websocket-protocol"],
        secWebSocketVersion: request.headers["sec-websocket-version"],
        origin: request.headers.origin,
        host: request.headers.host,
      }
    });
    
    // Soportar tanto /ocpp/ como /api/ocpp/ para compatibilidad
    const isOcppRoute = url.pathname.startsWith("/ocpp/") || url.pathname.startsWith("/api/ocpp/ws/");
    
    if (isOcppRoute) {
      console.log(`[OCPP] Handling upgrade for: ${url.pathname}`);
      
      // Manejar errores de socket
      socket.on("error", (err) => {
        console.error(`[OCPP] Socket error during upgrade:`, err);
      });
      
      // CRÍTICO: Configurar TCP keep-alive en el socket subyacente
      // Esto envía paquetes TCP keep-alive para evitar que proxies intermedios
      // cierren la conexión por inactividad a nivel de transporte
      const tcpSocket = socket as unknown as import('net').Socket;
      if (typeof tcpSocket.setKeepAlive === 'function') {
        tcpSocket.setKeepAlive(true, 15000); // TCP keep-alive cada 15 segundos
      }
      if (typeof tcpSocket.setTimeout === 'function') {
        tcpSocket.setTimeout(0); // Sin timeout en el socket TCP
      }
      if (typeof tcpSocket.setNoDelay === 'function') {
        tcpSocket.setNoDelay(true); // Desactivar Nagle para respuestas inmediatas
      }
      
      wss.handleUpgrade(request, socket, head, (ws) => {
        console.log(`[OCPP] Upgrade successful, emitting connection`);
        
        // También configurar el socket interno del WebSocket
        const rawSocket = (ws as any)._socket;
        if (rawSocket) {
          rawSocket.setKeepAlive(true, 15000);
          rawSocket.setTimeout(0);
          if (typeof rawSocket.setNoDelay === 'function') {
            rawSocket.setNoDelay(true);
          }
        }
        
        wss.emit("connection", ws, request);
      });
    } else {
      // No es una ruta OCPP, cerrar la conexión
      console.log(`[OCPP] Ignoring non-OCPP upgrade request: ${url.pathname}`);
      socket.destroy();
    }
  });

  // Manejar conexiones OCPP WebSocket
  wss.on("connection", async (ws, req) => {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    // El chargePointId viene después de /ocpp/
    const pathParts = url.pathname.split("/").filter(Boolean);
    const ocppIdentity = pathParts[pathParts.length - 1] || "";
    const protocol = ws.protocol || "ocpp1.6";
    const ocppVersion = protocol.includes("2.0") ? "2.0.1" : "1.6";

    // Marcar conexión como viva para ping/pong y guardar identidad para logging
    (ws as any).isAlive = true;
    (ws as any)._ocppIdentity = ocppIdentity;
    (ws as any)._connectedAt = Date.now();
    (ws as any)._missedPongs = 0; // Contador de pings sin respuesta
    (ws as any)._lastActivity = Date.now(); // Timestamp de última actividad (datos o pong)
    
    ws.on("pong", () => {
      (ws as any).isAlive = true;
      (ws as any)._missedPongs = 0; // Resetear contador de pongs perdidos
      (ws as any)._lastActivity = Date.now(); // Actualizar timestamp de actividad
      // Actualizar timestamp de última actividad en el connection manager
      ocppManager.updateLastMessage(ocppIdentity);
    });

    console.log(`[OCPP] New ${ocppVersion} connection established:`, {
      identity: ocppIdentity,
      url: req.url,
      protocol: protocol,
      remoteAddress: req.socket?.remoteAddress,
    });

    // BRIDGE CRÍTICO: Registrar la conexión en dualCSMS para que requestStartTransaction funcione.
    // El charger se conecta al WebSocket del servidor principal (puerto 3000),
    // pero startCharge usa dualCSMS.requestStartTransaction() que busca en dualCSMS.connections.
    // Sin este registro, dualCSMS.connections está vacío y los comandos nunca llegan al charger.
    const ocppVersionForDual = ocppVersion === "2.0.1" ? "2.0.1" : "1.6";
    dualCSMS.registerExternalConnection(ocppIdentity, ws, ocppVersionForDual as any);
    console.log(`[OCPP] Registered connection in dualCSMS bridge: ${ocppIdentity} (${ocppVersionForDual})`);

    // Delegar al manejador del CSMS
    handleOCPPConnection(ws, ocppIdentity, ocppVersion);
  });

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    console.log(`OCPP WebSocket endpoint: ws://localhost:${port}/ocpp/{chargePointId}`);
    
    // Iniciar cron job de cobro recurrente de suscripciones
    startBillingCronJob();
    
    // Iniciar reconciliación automática de transacciones Wompi pendientes (cada 5 min)
    startReconciliationCron();
    
    // Iniciar limpieza periódica de transacciones huérfanas (cada 15 minutos)
    startTransactionCleanupJob();
    
    // Iniciar monitoreo de saldo durante cargas activas (cada 30s)
    startBalanceMonitor();
    
    // Iniciar monitoreo de tarifa de ocupación (overstay) cada 60s
    startOverstayMonitor();
    
    // Fase 2 IA: Iniciar notificaciones proactivas basadas en perfil de consumo (cada 30 min)
    startProactiveNotifications();
    
    // Fase 3 IA: Iniciar predicción de demanda por estación (cada 6h)
    startDemandForecastJob();
    
    // Iniciar procesamiento de reservas vencidas (no-show) cada 60 segundos
    setInterval(async () => {
      try {
        await reservationJobs.processNoShows();
      } catch (e) {
        console.error("[ReservationJobs] Error in processNoShows:", e);
      }
    }, 60_000);
    // Ejecutar inmediatamente al iniciar
    reservationJobs.processNoShows().catch(e => console.error("[ReservationJobs] Initial processNoShows error:", e));
    
    // Iniciar procesamiento de recordatorios de reservas cada 60 segundos
    setInterval(async () => {
      try {
        await reservationJobs.processReminders();
      } catch (e) {
        console.error("[ReservationJobs] Error in processReminders:", e);
      }
    }, 60_000);
    // Iniciar procesamiento de activación de reservas próximas cada 60 segundos
    setInterval(async () => {
      try {
        await reservationJobs.processUpcomingReservations();
      } catch (e) {
        console.error("[ReservationJobs] Error in processUpcomingReservations:", e);
      }
    }, 60_000);
    // Ejecutar inmediatamente al iniciar
    reservationJobs.processUpcomingReservations().catch(e => console.error("[ReservationJobs] Initial processUpcomingReservations error:", e));
    console.log("[ReservationJobs] No-show processor, reminders and reservation activation started (every 60s)");
  });
}

// Función para manejar conexiones OCPP
async function handleOCPPConnection(ws: WebSocket, ocppIdentity: string, ocppVersion: string) {
  // Importar db al inicio
  const db = await import("../db");
  
  // Verificar si hay estado persistente (reconexión seamless)
  const previousState = ocppManager.getPersistentState(ocppIdentity);
  const isSeamlessReconnection = previousState?.isInGracePeriod === true;
  
  // Registrar en el connection manager (restaura estado si es reconexión seamless)
  const connection = ocppManager.registerConnection(ocppIdentity, ws, ocppVersion);
  
  // Si hay un grace period activo del legacy system, cancelarlo
  const existingGraceOnConnect = legacyDisconnectGrace.get(ocppIdentity);
  if (existingGraceOnConnect) {
    clearTimeout(existingGraceOnConnect);
    legacyDisconnectGrace.delete(ocppIdentity);
  }
  
  if (isSeamlessReconnection) {
    console.log(`[OCPP] ⚡ SEAMLESS RECONNECTION: ${ocppIdentity} - state restored (stationId=${connection.stationId}, connectors=${connection.connectorStatuses.size})`);
  }
  
  // Mapeo de transacciones OCPP 1.6 a IDs internos
  const ocpp16Transactions = new Map<number, string>();
  let transactionIdCounter = 1;

  // Registrar conexión - usar stationId restaurado si es reconexión seamless
  let stationId: number | null = connection.stationId;

  // PRE-RESOLVER stationId inmediatamente al conectarse (no esperar a BootNotification)
  try {
    const station = await db.getChargingStationByOcppIdentity(ocppIdentity);
    if (station) {
      stationId = station.id;
      // CRÍTICO: Actualizar stationId en el connection-manager para que getConnectionByStationId funcione
      connection.stationId = station.id;
      console.log(`[OCPP] Pre-resolved stationId=${stationId} for ${ocppIdentity} at connection time (updated in connection-manager)`);
      // Marcar como online
      await db.updateStationOnlineStatus(ocppIdentity, true);
      
      // Auto-resolver alertas de desconexión activas al reconectar
      alertsService.handleReconnection(ocppIdentity)
        .catch(err => console.error(`[OCPP Alert] Error auto-resolving on reconnect for ${ocppIdentity}:`, err));
    } else {
      console.warn(`[OCPP] Could not pre-resolve stationId for ${ocppIdentity} - station not found in DB`);
    }
  } catch (err) {
    console.error(`[OCPP] Error pre-resolving stationId for ${ocppIdentity}:`, err);
  }

  // Registrar el event listener PRIMERO, antes de cualquier operación async
  ws.on("message", async (data) => {
      // Actualizar timestamps de actividad (crítico para evitar desconexiones falsas)
      (ws as any)._lastActivity = Date.now();
      (ws as any)._missedPongs = 0; // Cualquier dato recibido = conexión viva
      ocppManager.updateLastMessage(ocppIdentity);
      try {
        const message = JSON.parse(data.toString());
        const messageType = message[0];

        // Manejar CALLRESULT (tipo 3) - respuestas del cargador a nuestros comandos
        if (messageType === 3) {
          const [, messageId, payload] = message;
          // Ignorar silenciosamente respuestas a keepalive y configuración automática
          if (messageId.startsWith('keepalive-') || messageId.startsWith('cfg-hb-') || messageId.startsWith('trigger-hb-')) {
            // Respuesta a nuestro TriggerMessage/ChangeConfiguration keepalive - OK, proxy timeout reseteado
            ocppManager.updateLastMessage(ocppIdentity);
            return;
          }
          console.log(`[OCPP] ${ocppIdentity} -> CALLRESULT [${messageId}]:`, JSON.stringify(payload).substring(0, 200));
          // BRIDGE CRÍTICO: Enrutar CALLRESULT a dualCSMS para resolver pendingCalls
          // Esto permite que sendCall() (usado por requestStartTransaction, requestStopTransaction, etc.)
          // reciba la respuesta del cargador y resuelva su Promise.
          const routed = dualCSMS.routeCallResult(ocppIdentity, messageId, payload);
          if (routed) {
            console.log(`[OCPP] CALLRESULT [${messageId}] routed to dualCSMS pending call for ${ocppIdentity}`);
          }
          return;
        }

        // Manejar CALLERROR (tipo 4) - errores del cargador
        if (messageType === 4) {
          const [, messageId, errorCode, errorDescription] = message;
          if (messageId.startsWith('keepalive-') || messageId.startsWith('cfg-hb-') || messageId.startsWith('trigger-hb-')) {
            // Error en keepalive - ignorar silenciosamente (algunos cargadores no soportan TriggerMessage)
            console.log(`[OCPP] ${ocppIdentity} -> Keepalive command not supported: ${errorCode} - ${errorDescription}`);
            return;
          }
          console.log(`[OCPP] ${ocppIdentity} -> CALLERROR [${messageId}]: ${errorCode} - ${errorDescription}`);
          // BRIDGE: Enrutar CALLERROR a dualCSMS para rechazar pendingCalls
          const errorRouted = dualCSMS.routeCallError(ocppIdentity, messageId, errorCode, errorDescription);
          if (errorRouted) {
            console.log(`[OCPP] CALLERROR [${messageId}] routed to dualCSMS pending call for ${ocppIdentity}`);
          }
          return;
        }

        if (messageType === 2) { // CALL
          const [, messageId, action, payload] = message;
          console.log(`[OCPP] ${ocppIdentity} -> ${action}:`, JSON.stringify(payload).substring(0, 200));

          await db.createOcppLog({
            ocppIdentity,
            stationId,
            direction: "IN",
            messageType: action,
            payload,
          });

          let response: any = {};

          // AUTO-RESOLUCIÓN: Si stationId sigue null, intentar resolverlo antes de procesar
          if (!stationId && action !== "BootNotification") {
            try {
              const station = await db.getChargingStationByOcppIdentity(ocppIdentity);
              if (station) {
                stationId = station.id;
                connection.stationId = station.id; // Actualizar en connection-manager
                console.log(`[OCPP] Auto-resolved stationId=${stationId} for ${ocppIdentity} in handleMessage (updated in connection-manager)`);
              }
            } catch (err) {
              console.error(`[OCPP] Error auto-resolving stationId:`, err);
            }
          }

          // Manejar mensajes según versión
          if (ocppVersion === "1.6") {
            response = await handleOCPP16Message(action, payload, ocppIdentity, stationId, db, ocpp16Transactions, transactionIdCounter++);
          } else {
            response = await handleOCPP201Message(action, payload, ocppIdentity, stationId, db);
          }

          // Actualizar stationId si se obtuvo en BootNotification
          if (action === "BootNotification" && response._stationId) {
            stationId = response._stationId;
            delete response._stationId;
            
            // Actualizar info en connection manager
            const bootInfo = ocppVersion === "1.6" ? {
              vendor: payload.chargePointVendor,
              model: payload.chargePointModel,
              serialNumber: payload.chargePointSerialNumber || payload.chargeBoxSerialNumber,
              firmwareVersion: payload.firmwareVersion,
            } : {
              vendor: payload.chargingStation?.vendorName,
              model: payload.chargingStation?.model,
              serialNumber: payload.chargingStation?.serialNumber,
              firmwareVersion: payload.chargingStation?.firmwareVersion,
            };
            ocppManager.updateBootInfo(ocppIdentity, bootInfo, stationId);
            
            // BRIDGE: Actualizar stationId en dualCSMS para que requestStartTransaction pueda encontrar la conexión
            if (stationId) {
              dualCSMS.updateExternalConnectionStationId(ocppIdentity, stationId);
            }
            
            // CAPA 3: Después de BootNotification, configurar HeartbeatInterval agresivo
            // para generar tráfico de datos bidireccional frecuente que resetee el proxy timeout
            setTimeout(() => {
              try {
                if (ws.readyState === 1) {
                  // Reducir HeartbeatInterval a 30 segundos (por defecto suele ser 60-300s)
                  const changeConfigMsg = JSON.stringify([2, `cfg-hb-${Date.now()}`, "ChangeConfiguration", {
                    key: "HeartbeatInterval",
                    value: "30"
                  }]);
                  ws.send(changeConfigMsg);
                  console.log(`[OCPP] Sent ChangeConfiguration HeartbeatInterval=30 to ${ocppIdentity}`);
                  
                  // También solicitar un Heartbeat inmediato para generar tráfico
                  setTimeout(() => {
                    if (ws.readyState === 1) {
                      const triggerMsg = JSON.stringify([2, `trigger-hb-${Date.now()}`, "TriggerMessage", {
                        requestedMessage: "Heartbeat"
                      }]);
                      ws.send(triggerMsg);
                      console.log(`[OCPP] Sent initial TriggerMessage Heartbeat to ${ocppIdentity}`);
                    }
                  }, 2000);
                }
              } catch (err) {
                console.error(`[OCPP] Error sending post-boot configuration to ${ocppIdentity}:`, err);
              }
            }, 3000); // Esperar 3s después de BootNotification para que el cargador esté listo
          }
          
          // Actualizar heartbeat
          if (action === "Heartbeat") {
            ocppManager.updateHeartbeat(ocppIdentity);
          }
          
          // Actualizar estado de conector
          if (action === "StatusNotification") {
            const connectorId = payload.connectorId || payload.evseId || 0;
            const status = payload.status || payload.connectorStatus || "Unknown";
            const errorCode = payload.errorCode || "NoError";
            ocppManager.updateConnectorStatus(ocppIdentity, connectorId, status);
            
            // Generar alerta si hay error
            if (errorCode !== "NoError") {
              alertsService.handleStatusError(
                ocppIdentity,
                stationId ?? undefined,
                connectorId,
                errorCode,
                status,
                payload.vendorErrorCode,
                payload.info
              ).catch(err => console.error("[OCPP Alert] Error:", err));
            }
          }

          // Enviar respuesta
          const callResult = [3, messageId, response];
          ws.send(JSON.stringify(callResult));

          console.log(`[OCPP] ${ocppIdentity} <- ${action}:`, JSON.stringify(response).substring(0, 200));

          await db.createOcppLog({
            ocppIdentity,
            stationId,
            direction: "OUT",
            messageType: action,
            payload: response,
          });
        }
      } catch (error) {
        console.error(`[OCPP] Error processing message from ${ocppIdentity}:`, error);
      }
    });

    ws.on("close", async (code: number, reason: Buffer) => {
      // BRIDGE: Limpiar conexión en dualCSMS cuando el WebSocket se cierra
      // Pasar el ws que se cerró para evitar race condition con reconexiones rápidas
      dualCSMS.removeExternalConnection(ocppIdentity, ws);
      
      const connectedAt = (ws as any)._connectedAt || 0;
      const durationSec = connectedAt ? Math.round((Date.now() - connectedAt) / 1000) : 0;
      const reasonStr = reason?.toString() || '';
      const persistentState = ocppManager.getPersistentState(ocppIdentity);
      const seamlessCount = persistentState?.seamlessReconnections || 0;
      
      console.log(`[OCPP] Connection closed: ${ocppIdentity}`, {
        closeCode: code,
        closeReason: reasonStr,
        connectionDurationSeconds: durationSec,
        wasAlive: (ws as any).isAlive,
        seamlessReconnections: seamlessCount,
      });
      
      // Delegar al connection-manager: inicia grace period y preserva estado
      const { isGracePeriod } = ocppManager.handleDisconnection(ocppIdentity, code, reasonStr);
      
      // Registrar log de desconexión (para auditoría, marcado como proxy_cycle si es código 1006)
      // Proxy Cycle: Railway/proxy recicla la conexión WebSocket periódicamente.
      // Rango ampliado: 60-300s cubre variaciones del proxy timeout (no solo 170-200s)
      // También considerar código 1001 (Going Away) que algunos proxies usan
      const isProxyCycle = (code === 1006 || code === 1001) && durationSec >= 60 && durationSec <= 300;
      await db.createOcppLog({
        ocppIdentity,
        stationId,
        direction: "IN",
        messageType: isProxyCycle ? "PROXY_RECONNECT" : "DISCONNECTION",
        payload: { 
          closeCode: code, 
          closeReason: reasonStr, 
          connectionDurationSeconds: durationSec,
          wasAlive: (ws as any).isAlive,
          isProxyCycle,
          seamlessReconnections: seamlessCount,
        },
      });
      
      // NO marcar offline inmediatamente - el connection-manager maneja el grace period
      // Solo si el grace period expira Y no se reconecta, marcar offline
      // Cancelar grace period anterior del legacy system si existe
      const existingGrace = legacyDisconnectGrace.get(ocppIdentity);
      if (existingGrace) {
        clearTimeout(existingGrace);
        legacyDisconnectGrace.delete(ocppIdentity);
      }
      
      // Iniciar timer para verificar después del grace period
      const graceTimeout = setTimeout(async () => {
        // Verificar si el cargador se reconectó (el connection-manager ya sabe)
        const currentConn = ocppManager.getConnection(ocppIdentity);
        const stillInGrace = ocppManager.isInGracePeriod(ocppIdentity);
        
        if (!currentConn && !stillInGrace) {
          // Grace period expiró sin reconexión → desconexión REAL
          console.log(`[OCPP] ❌ REAL DISCONNECTION after grace period: ${ocppIdentity}`);
          
          if (stationId) {
            await db.updateStationOnlineStatus(ocppIdentity, false);
          }
          
          // Generar alerta solo para desconexiones REALES
          alertsService.handleDisconnection(ocppIdentity, stationId ?? undefined)
            .catch(err => console.error("[OCPP Alert] Error:", err));
        } else if (currentConn) {
          console.log(`[OCPP] ⚡ Seamless reconnection confirmed: ${ocppIdentity}`);
          // Auto-resolver alertas pendientes también en reconexiones seamless
          alertsService.handleReconnection(ocppIdentity)
            .catch(err => console.error(`[OCPP Alert] Error auto-resolving on seamless reconnect for ${ocppIdentity}:`, err));
        }
        legacyDisconnectGrace.delete(ocppIdentity);
      }, LEGACY_DISCONNECT_GRACE_MS);
      
      legacyDisconnectGrace.set(ocppIdentity, graceTimeout);
    });

    ws.on("error", (error) => {
      console.error(`[OCPP] WebSocket error from ${ocppIdentity}:`, error);
    });

  // Registrar conexión después de configurar los listeners
  try {
    await db.createOcppLog({
      ocppIdentity,
      direction: "IN",
      messageType: "CONNECTION",
      payload: { ocppVersion },
    });
  } catch (err) {
    console.error(`[OCPP] Error logging connection:`, err);
  }
}

// Handler para mensajes OCPP 1.6
async function handleOCPP16Message(
  action: string,
  payload: any,
  ocppIdentity: string,
  stationId: number | null,
  db: any,
  ocpp16Transactions: Map<number, string>,
  transactionIdCounter: number
): Promise<any> {
  switch (action) {
    case "BootNotification": {
      let station = await db.getChargingStationByOcppIdentity(ocppIdentity);
      if (station) {
        await db.updateChargingStation(station.id, {
          isOnline: true,
          manufacturer: payload.chargePointVendor,
          model: payload.chargePointModel,
          serialNumber: payload.chargePointSerialNumber || payload.chargeBoxSerialNumber,
          firmwareVersion: payload.firmwareVersion,
          lastBootNotification: new Date(),
        });
      }
      return {
        currentTime: new Date().toISOString(),
        interval: 30, // Heartbeat cada 30s para mantener proxy activo (era 60)
        status: station ? "Accepted" : "Pending",
        _stationId: station?.id,
      };
    }
    case "Heartbeat": {
      return { currentTime: new Date().toISOString() };
    }
    case "StatusNotification": {
      // Auto-resolver stationId si es null
      let resolvedStationId = stationId;
      if (!resolvedStationId && ocppIdentity) {
        try {
          const station = await db.getChargingStationByOcppIdentity(ocppIdentity);
          if (station) resolvedStationId = station.id;
        } catch (err) {
          console.error(`[OCPP] StatusNotification auto-resolve error:`, err);
        }
      }
      if (resolvedStationId && payload.connectorId > 0) {
        const evses = await db.getEvsesByStationId(resolvedStationId);
        const evse = evses.find((e: any) => e.evseIdLocal === payload.connectorId);
        if (evse) {
          const statusMap: Record<string, string> = {
            Available: "AVAILABLE",
            Preparing: "PREPARING",
            Charging: "CHARGING",
            SuspendedEV: "SUSPENDED_EV",
            SuspendedEVSE: "SUSPENDED_EVSE",
            Finishing: "FINISHING",
            Reserved: "RESERVED",
            Unavailable: "UNAVAILABLE",
            Faulted: "FAULTED",
          };
          const newStatus = statusMap[payload.status] || "UNAVAILABLE";
          
          // PROTECCIÓN: No sobreescribir RESERVED a menos que sea el cargador reportando RESERVED
          if (evse.status === "RESERVED" && newStatus !== "RESERVED" && newStatus !== "CHARGING" && newStatus !== "PREPARING") {
            console.log(`[OCPP] StatusNotification - Skipping update: EVSE ${evse.id} is RESERVED, ignoring ${newStatus}`);
          } else {
            await db.updateEvseStatus(evse.id, newStatus);
            console.log(`[OCPP] StatusNotification - Updated EVSE ${evse.id} to ${newStatus} (OCPP: ${payload.status})`);
          }
          
          // OVERSTAY: Detectar transición a Finishing (carga completada, cable conectado)
          // IMPORTANTE: Solo "Finishing" indica carga completada. "SuspendedEV" significa que el
          // BMS del vehículo redujo/pausó la corriente temporalmente (fase taper en AC, ~80-90% SoC)
          // y NO debe disparar overstay porque el carro puede seguir cargando.
          if (payload.status === "Finishing") {
            console.log(`[OCPP] StatusNotification - EVSE ${evse.id} entered Finishing, starting overstay tracking`);
            onChargingFinished(evse.id, resolvedStationId).catch(err => 
              console.error(`[OCPP] Error starting overstay tracking:`, err)
            );
          }
          
          // OVERSTAY: Detectar cable desconectado (Available)
          if (payload.status === "Available") {
            console.log(`[OCPP] StatusNotification - EVSE ${evse.id} now Available, finalizing overstay if active`);
            onCableDisconnected(evse.id).catch(err => 
              console.error(`[OCPP] Error finalizing overstay:`, err)
            );
          }
        }
      } else if (payload.connectorId === 0 && resolvedStationId) {
        // connectorId=0 es la estación completa, actualizar isOnline
        await db.updateStationOnlineStatus(ocppIdentity, payload.status !== "Unavailable" && payload.status !== "Faulted");
      }
      return {};
    }
    case "Authorize": {
      // Validar idTag - MODO PERMISIVO: siempre aceptar para no bloquear cargas
      const authIdTag = payload.idTag;
      if (authIdTag) {
        // 1. Buscar en tabla id_tags (APP, RFID, NFC)
        try {
          const tagResult = await db.getUserByIdTagFromTable(authIdTag);
          if (tagResult) {
            const tagUser = await db.getUserById(tagResult.userId);
            if (tagUser && tagUser.isActive) {
              console.log(`[OCPP] Authorize - User ${tagUser.name || tagUser.email} (ID: ${tagUser.id}) authorized via id_tags`);
              return {
                idTagInfo: {
                  status: "Accepted",
                  expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                  parentIdTag: tagUser.id.toString(),
                },
              };
            } else if (tagUser && !tagUser.isActive) {
              console.log(`[OCPP] Authorize - User ${tagUser.id} is blocked, but accepting in permissive mode`);
            }
          }
        } catch (err) {
          console.error(`[OCPP] Authorize id_tags lookup error:`, err);
        }
        
        // 2. Buscar en tabla users (legacy)
        try {
          const user = await db.getUserByIdTag(authIdTag);
          if (user && user.isActive) {
            console.log(`[OCPP] Authorize - User ${user.name || user.email} (ID: ${user.id}) authorized via users table`);
            return {
              idTagInfo: {
                status: "Accepted",
                expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                parentIdTag: user.id.toString(),
              },
            };
          }
        } catch (err) {
          console.error(`[OCPP] Authorize users lookup error:`, err);
        }
        
        // 3. MODO PERMISIVO: aceptar idTags desconocidos para no bloquear cargas físicas
        console.log(`[OCPP] Authorize - Unknown idTag: ${authIdTag}, accepting in permissive mode`);
      } else {
        console.log(`[OCPP] Authorize - No idTag provided, accepting in permissive mode`);
      }
      return {
        idTagInfo: {
          status: "Accepted",
          expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
      };
    }
    case "StartTransaction": {
      // AUTO-RESOLUCIÓN de stationId
      let resolvedStId = stationId;
      if (!resolvedStId) {
        try {
          const station = await db.getChargingStationByOcppIdentity(ocppIdentity);
          if (station) {
            resolvedStId = station.id;
            console.log(`[OCPP] StartTransaction - Auto-resolved stationId=${resolvedStId} for ${ocppIdentity}`);
          }
        } catch (err) {
          console.error(`[OCPP] StartTransaction auto-resolve error:`, err);
        }
      }
      if (!resolvedStId) {
        console.error(`[OCPP] StartTransaction - Cannot resolve station for ${ocppIdentity}, rejecting`);
        return { idTagInfo: { status: "Invalid" }, transactionId: 0 };
      }
      const evses = await db.getEvsesByStationId(resolvedStId);
      let evse = evses.find((e: any) => e.evseIdLocal === payload.connectorId);
      // Fallback: si no encuentra el conector exacto, usar el primero disponible
      if (!evse && evses.length > 0) {
        evse = evses[0];
        console.log(`[OCPP] StartTransaction - Connector ${payload.connectorId} not found, using first EVSE ${evse.id}`);
      }
      if (!evse) {
        console.error(`[OCPP] StartTransaction - No EVSEs found for station ${resolvedStId}`);
        return { idTagInfo: { status: "Invalid" }, transactionId: 0 };
      }
      
      // Buscar usuario por idTag - primero en id_tags, luego en users
      const idTag = payload.idTag;
      let userId: number | null = null;
      let userName = "Usuario";
      
      if (idTag) {
        // Buscar en tabla id_tags (soporta APP, RFID, NFC)
        try {
          const tagResult = await db.getUserByIdTagFromTable(idTag);
          if (tagResult) {
            userId = tagResult.userId;
            const user = await db.getUserById(tagResult.userId);
            userName = user?.name || user?.email || "Usuario";
            console.log(`[OCPP] StartTransaction - User ${userName} (ID: ${userId}) found via id_tags table`);
          }
        } catch (err) {
          console.error(`[OCPP] StartTransaction id_tags lookup error:`, err);
        }
        
        // Fallback: buscar en tabla users (legacy)
        if (!userId) {
          const user = await db.getUserByIdTag(idTag);
          if (user && user.isActive) {
            userId = user.id;
            userName = user.name || user.email || "Usuario";
            console.log(`[OCPP] StartTransaction - User ${userName} (ID: ${userId}) found via users table (legacy)`);
          } else if (user && !user.isActive) {
            console.log(`[OCPP] StartTransaction - User with idTag ${idTag} is blocked`);
            // NO rechazar, aceptar pero sin userId
          } else {
            console.log(`[OCPP] StartTransaction - Unknown idTag: ${idTag}, transaction will be anonymous`);
          }
        }
        
        // Fallback: formato USER-{id}
        if (!userId && idTag.startsWith("USER-")) {
          const uid = parseInt(idTag.replace("USER-", ""), 10);
          if (!isNaN(uid)) {
            userId = uid;
            console.log(`[OCPP] StartTransaction - Resolved userId=${uid} from USER- format idTag`);
          }
        }
      }
      
      const tariff = await db.getActiveTariffByStationId(resolvedStId);
      const { nanoid } = await import("nanoid");
      const internalTransactionId = nanoid();
      
      // Buscar sesión pendiente para obtener chargeMode/targetValue (memoria + BD fallback)
      const { findPendingSessionByOcppIdentity: findPendingOcpp, findPendingSessionFromDb: findPendingDb } = await import("../charging/charging-router");
      let pendingSessionForTx = findPendingOcpp(ocppIdentity, payload.connectorId);
      if (!pendingSessionForTx) {
        // Fallback: buscar en BD (multi-instancia)
        pendingSessionForTx = await findPendingDb(ocppIdentity, payload.connectorId);
      }
      if (!pendingSessionForTx) {
        // Intentar sin connectorId
        pendingSessionForTx = findPendingOcpp(ocppIdentity);
        if (!pendingSessionForTx) {
          pendingSessionForTx = await findPendingDb(ocppIdentity);
        }
      }
      const txChargeMode = pendingSessionForTx?.session?.chargeMode || "full_charge";
      const txTargetValue = pendingSessionForTx?.session?.targetValue || 0;
      const txPricePerKwh = pendingSessionForTx?.session?.pricePerKwh || (tariff ? parseFloat(tariff.pricePerKwh) : 1800);
      
      const newTxId = await db.createTransaction({
        evseId: evse.id,
        userId: userId || 1, // Usar usuario encontrado o fallback a 1 (admin)
        stationId: resolvedStId,
        tariffId: tariff?.id,
        ocppTransactionId: internalTransactionId,
        ocppNumericTxId: transactionIdCounter, // ID numérico OCPP 1.6 para RemoteStopTransaction
        startTime: new Date(payload.timestamp),
        status: "IN_PROGRESS",
        meterStart: String(payload.meterStart),
        chargeMode: txChargeMode,
        targetValue: String(txTargetValue),
        appliedPricePerKwh: String(txPricePerKwh),
      });
      console.log(`[OCPP] StartTransaction - Created tx: dbId=${newTxId}, ocppNumericTxId=${transactionIdCounter}, internalId=${internalTransactionId}`);
      
      ocpp16Transactions.set(transactionIdCounter, internalTransactionId);
      await db.updateEvseStatus(evse.id, "CHARGING");
      
      // Enviar notificación al usuario cuando inicia la carga
      if (userId) {
        try {
          const station = await db.getChargingStationById(resolvedStId);
          const stationName = station?.name || "Estación";
          // Usar precio dinámico de la transacción (ya calculado al iniciar)
          const formattedPrice = Math.round(txPricePerKwh).toLocaleString("es-CO");
          await db.createNotification({
            userId: userId,
            title: "Carga iniciada",
            message: `Hola ${userName}, tu carga ha comenzado en ${stationName}. Tarifa: $${formattedPrice} COP/kWh. Te notificaremos cuando finalice.`,
            type: "CHARGE_START",
            referenceId: null,
            referenceType: "transaction",
          });
          // WhatsApp: notificar inicio de carga
          try {
            const userForWa = await db.getUserById(userId);
            console.log(`[WhatsApp] charge_start (legacy): user=${userId}, phone=${userForWa?.phone || 'NULL'}`);
            if (userForWa?.phone) {
              const { sendWhatsAppTemplate, WA_TEMPLATE_NAMES } = await import("../whatsapp/whatsapp-service");
              const { getStationTimezone, formatTimeInTz } = await import("../utils/timezone");
              const stationTz = getStationTimezone(station ?? {});
              sendWhatsAppTemplate({
                toPhone: userForWa.phone,
                templateName: WA_TEMPLATE_NAMES.inicio_carga,
                parameters: [
                  userForWa.name?.split(" ")[0] || "Usuario",
                  stationName,
                  String(payload.connectorId),
                  formatTimeInTz(new Date(), stationTz),
                ],
                eventType: "charge_start",
                userId,
                referenceId: newTxId,
                referenceType: "transaction",
              }).then(ok => console.log(`[WhatsApp] charge_start (legacy): result=${ok}`)).catch((e: Error) => console.error("[WhatsApp] charge_start (legacy) error:", e.message));
            }
          } catch (waErr: any) {
            console.error(`[WhatsApp] charge_start (legacy) exception:`, waErr?.message);
          }
        } catch (notifErr) {
          console.error(`[OCPP] Error sending charge start notification:`, notifErr);
        }
      }
      
      return {
        idTagInfo: { status: userId ? "Accepted" : "Accepted" }, // Aceptar incluso sin usuario para permitir cargas anónimas
        transactionId: transactionIdCounter,
      };
    }
    case "StopTransaction": {
      // Búsqueda multi-estrategia de la transacción
      let internalTransactionId = ocpp16Transactions.get(payload.transactionId);
      let transaction: any = null;
      
      // Estrategia 1: Buscar por mapa en memoria
      if (internalTransactionId) {
        transaction = await db.getTransactionByOcppId(internalTransactionId);
        if (transaction) {
          console.log(`[OCPP] StopTransaction - Found via memory map: txId=${payload.transactionId}`);
        }
      }
      
      // Estrategia 2: Buscar transacción activa por EVSE de la estación
      if (!transaction) {
        let resolvedStopStId = stationId;
        if (!resolvedStopStId) {
          try {
            const station = await db.getChargingStationByOcppIdentity(ocppIdentity);
            if (station) resolvedStopStId = station.id;
          } catch (err) {
            console.error(`[OCPP] StopTransaction auto-resolve error:`, err);
          }
        }
        if (resolvedStopStId) {
          try {
            const activeTransactions = await db.getActiveTransactionsByStationId(resolvedStopStId);
            if (activeTransactions && activeTransactions.length > 0) {
              transaction = activeTransactions[0];
              console.log(`[OCPP] StopTransaction - Found via active EVSE: txId=${transaction.id}`);
            }
          } catch (err) {
            console.error(`[OCPP] StopTransaction EVSE lookup error:`, err);
          }
        }
      }
      
      // Estrategia 3: Buscar por idTag del usuario
      if (!transaction && payload.idTag) {
        try {
          const tagResult = await db.getUserByIdTagFromTable(payload.idTag);
          const userId = tagResult?.userId;
          if (userId) {
            const userTx = await db.getActiveTransactionByUserId(userId);
            if (userTx) {
              transaction = userTx;
              console.log(`[OCPP] StopTransaction - Found via idTag user: txId=${transaction.id}`);
            }
          }
        } catch (err) {
          console.error(`[OCPP] StopTransaction idTag lookup error:`, err);
        }
      }
      
      // Si no se encontró transacción, aceptar y limpiar EVSEs
      if (!transaction) {
        console.warn(`[OCPP] StopTransaction - No transaction found for txId=${payload.transactionId}, idTag=${payload.idTag}. Accepting and cleaning up.`);
        // Limpiar EVSEs de la estación a AVAILABLE
        let cleanupStId = stationId;
        if (!cleanupStId) {
          try {
            const station = await db.getChargingStationByOcppIdentity(ocppIdentity);
            if (station) cleanupStId = station.id;
          } catch (err) { /* ignore */ }
        }
        if (cleanupStId) {
          try {
            const evses = await db.getEvsesByStationId(cleanupStId);
            for (const e of evses) {
              if (e.status !== "AVAILABLE") {
                await db.updateEvseStatus(e.id, "AVAILABLE");
              }
            }
          } catch (err) { /* ignore */ }
        }
        return { idTagInfo: { status: "Accepted" } };
      }
      const meterStart = transaction.meterStart ? parseFloat(transaction.meterStart) : 0;
      const energyDelivered = (payload.meterStop - meterStart) / 1000;
      const tariff = transaction.tariffId ? await db.getTariffById(transaction.tariffId) : null;
      // Priorizar precio dinámico guardado en la transacción
      const pricePerKwh = (transaction as any).appliedPricePerKwh 
        ? parseFloat(String((transaction as any).appliedPricePerKwh))
        : (tariff ? parseFloat(tariff.pricePerKwh) : 1800);
      const energyCost = energyDelivered * pricePerKwh;
      
      // Calcular duración y costos adicionales
      const startTime = new Date(transaction.startTime);
      const endTime = payload.timestamp ? new Date(payload.timestamp) : new Date();
      const durationMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
      
      // Costo por tiempo (si aplica)
      const pricePerMinute = tariff ? parseFloat(tariff.pricePerMinute || "0") : 0;
      const timeCost = durationMinutes * pricePerMinute;
      
      // Costo de sesión/conexión fijo (pricePerSession en tarifa)
      const sessionFee = tariff ? parseFloat(tariff.pricePerSession || "0") : 0;
      
      // Total
      const totalCost = energyCost + timeCost + sessionFee;
      
      // Distribución de ingresos según configuración del admin
      const revenueConfig = await db.getRevenueShareConfig();
      const investorShare = totalCost * (revenueConfig.investorPercent / 100);
      const platformFee = totalCost * (revenueConfig.platformPercent / 100);
      
      await db.updateTransaction(transaction.id, {
        endTime,
        meterEnd: String(payload.meterStop),
        kwhConsumed: energyDelivered.toFixed(4),
        energyCost: energyCost.toFixed(2),
        timeCost: timeCost.toFixed(2),
        sessionCost: sessionFee.toFixed(2),
        totalCost: totalCost.toFixed(2),
        investorShare: investorShare.toFixed(2),
        platformFee: platformFee.toFixed(2),
        status: "COMPLETED",
        stopReason: payload.reason || "Remote",
      });
      
      // Actualizar estado del EVSE a FINISHING (cable aún puede estar conectado)
      // El StatusNotification posterior determinará si pasa a Available o se queda en Finishing
      await db.updateEvseStatus(transaction.evseId, "FINISHING");
      console.log(`[OCPP] StopTransaction - EVSE ${transaction.evseId} set to FINISHING (pending cable disconnect)`);
      
      // Iniciar tracking de overstay inmediatamente
      onChargingFinished(transaction.evseId, transaction.stationId).catch(err => 
        console.error(`[OCPP] Error starting overstay tracking after StopTransaction:`, err)
      );
      
      // Descontar saldo del usuario
      if (totalCost > 0 && transaction.userId) {
        try {
          const wallet = await db.getWalletByUserId(transaction.userId);
          if (wallet) {
            let currentBalance = parseFloat(wallet.balance);
            
            // Auto-cobro: si el saldo es insuficiente y tiene tarjeta inscrita
            if (currentBalance < totalCost) {
              try {
                const { autoChargeIfNeeded } = await import("../wompi/auto-charge");
                const autoResult = await autoChargeIfNeeded(transaction.userId, totalCost);
                if (autoResult?.success) {
                  currentBalance = autoResult.newBalance;
                  console.log(`[OCPP] StopTransaction - Auto-cobro exitoso: $${autoResult.amountCharged} cobrados a tarjeta`);
                } else if (autoResult) {
                  console.log(`[OCPP] StopTransaction - Auto-cobro fallido: ${autoResult.error}`);
                }
              } catch (autoErr) {
                console.warn(`[OCPP] StopTransaction - Error en auto-cobro:`, autoErr);
              }
            }
            
            const newBalance = Math.max(0, currentBalance - totalCost);
            await db.updateWalletBalance(transaction.userId, newBalance.toString());
            
            await db.createWalletTransaction({
              walletId: wallet.id,
              userId: transaction.userId,
              type: "CHARGE_PAYMENT",
              amount: (-totalCost).toString(),
              balanceBefore: currentBalance.toString(),
              balanceAfter: newBalance.toString(),
              referenceId: transaction.id,
              referenceType: "TRANSACTION",
              status: "COMPLETED",
              description: `Pago por carga de ${energyDelivered.toFixed(2)} kWh`,
            });
            
            console.log(`[OCPP] StopTransaction - Wallet deducted: $${Math.round(totalCost)} from user ${transaction.userId}. Balance: $${currentBalance} -> $${newBalance}`);
          }
        } catch (walletErr: any) {
          console.error(`[OCPP] Error deducting user wallet:`, walletErr?.message || walletErr);
          // No lanzar error - la transacción ya se completó
        }
      }
      
      // ============================================================
      // REGISTRO DE PRECISIÓN DE SOC (antes de limpiar la sesión)
      // Registra la comparación entre el SoC manual del usuario y los datos reales
      // ============================================================
      try {
        const { getActiveSessionById } = await import("../charging/charging-router");
        const activeSession = getActiveSessionById(transaction.id);
        
        // Obtener SoC manual: priorizar sesión en memoria, luego DB
        const manualSocValue = activeSession?.manualSoc ?? (transaction as any).manualSoc ?? null;
        const batteryCapKwh = activeSession?.manualBatteryCapacityKwh 
          ?? ((transaction as any).manualBatteryCapacityKwh ? parseFloat(String((transaction as any).manualBatteryCapacityKwh)) : null);
        
        if (manualSocValue !== null && batteryCapKwh && batteryCapKwh > 0 && energyDelivered > 0) {
          const calculatedSocEnd = Math.min(100, Math.round(manualSocValue + (energyDelivered / batteryCapKwh) * 100));
          const chargerSocEnd = activeSession?.soc ?? null;
          let estimatedErrorKwh: number | null = null;
          let estimatedErrorSocPct: number | null = null;
          if (chargerSocEnd !== null) {
            estimatedErrorSocPct = calculatedSocEnd - chargerSocEnd;
            estimatedErrorKwh = Math.round((estimatedErrorSocPct / 100) * batteryCapKwh * 10) / 10;
          }
          
          // Obtener vehículo del usuario para vincular
          let vehicleId: number | null = null;
          try {
            const defaultVehicle = await db.getDefaultVehicle(transaction.userId);
            if (defaultVehicle) vehicleId = defaultVehicle.id;
          } catch (e) { /* ignore */ }
          
          const detectionMethod = activeSession?.chargeCompleteDetected
            ? (activeSession.soc !== null ? 'charger_soc' : 'power_drop')
            : (payload.reason === 'Remote' ? 'target_reached' : 'user_stop');
          
          await db.createSocAccuracyLog({
            userId: transaction.userId,
            transactionId: transaction.id,
            vehicleId,
            manualSocStart: manualSocValue,
            manualBatteryCapacityKwh: batteryCapKwh,
            realKwhDelivered: Math.round(energyDelivered * 100) / 100,
            calculatedSocEnd,
            chargerSocEnd,
            batteryFullDetected: activeSession?.chargeCompleteDetected ?? false,
            detectionMethod,
            estimatedErrorKwh,
            estimatedErrorSocPct,
          });
          console.log(`[OCPP] StopTransaction - SoC accuracy logged: manual=${manualSocValue}%, calculated=${calculatedSocEnd}%, charger=${chargerSocEnd ?? 'N/A'}%, error=${estimatedErrorSocPct ?? 'N/A'}%`);
        } else {
          console.log(`[OCPP] StopTransaction - SoC accuracy NOT logged: manualSoc=${manualSocValue}, batteryCapKwh=${batteryCapKwh}, energyDelivered=${energyDelivered.toFixed(4)}`);
        }
      } catch (socErr) {
        console.error(`[OCPP] Error logging SoC accuracy:`, socErr);
      }
      
      // Limpiar sesión activa de memoria
      const { removeActiveSession } = await import("../charging/charging-router");
      removeActiveSession(transaction.id);
      
      // Actualizar wallet del inversor (si existe)
      let stationName = "Estación";
      try {
        const station = await db.getChargingStationById(transaction.stationId);
        if (station) {
          stationName = station.name || "Estación";
          if (station.ownerId) {
            await db.addInvestorEarnings(station.ownerId, investorShare, transaction.id);
            console.log(`[OCPP] StopTransaction - Added $${investorShare.toFixed(0)} COP to investor ${station.ownerId} wallet`);
          }
        }
      } catch (err) {
        console.error(`[OCPP] Error updating investor wallet:`, err);
      }
      
      // Enviar notificación al usuario cuando termina la carga
      if (transaction.userId) {
        try {
          await db.createNotification({
            userId: transaction.userId,
            title: "⚡ Carga completada",
            message: `Tu carga en ${stationName} ha finalizado. Consumiste ${energyDelivered.toFixed(2)} kWh por un total de $${totalCost.toLocaleString()} COP. Duración: ${Math.round(durationMinutes)} minutos.`,
            type: "CHARGE_COMPLETE",
            referenceId: transaction.id,
            referenceType: "transaction",
          });
          console.log(`[OCPP] Notification sent to user ${transaction.userId} for completed charge`);
          // WhatsApp: notificar fin de carga
          try {
            const userForWaEnd = await db.getUserById(transaction.userId);
            console.log(`[WhatsApp] charge_end (legacy): user=${transaction.userId}, phone=${userForWaEnd?.phone || 'NULL'}`);
            if (userForWaEnd?.phone) {
              const { sendWhatsAppTemplate, WA_TEMPLATE_NAMES } = await import("../whatsapp/whatsapp-service");
              const walletForEnd = await db.getWalletByUserId(transaction.userId);
              const balanceStr = walletForEnd ? `$${Math.round(parseFloat(walletForEnd.balance)).toLocaleString("es-CO")}` : "$0";
              sendWhatsAppTemplate({
                toPhone: userForWaEnd.phone,
                templateName: WA_TEMPLATE_NAMES.fin_carga,
                parameters: [
                  userForWaEnd.name?.split(" ")[0] || "Usuario",
                  energyDelivered.toFixed(2),
                  String(Math.round(durationMinutes)),
                  `$${Math.round(totalCost).toLocaleString("es-CO")}`,
                  balanceStr,
                ],
                eventType: "charge_end",
                userId: transaction.userId,
                referenceId: transaction.id,
                referenceType: "transaction",
              }).then(ok => console.log(`[WhatsApp] charge_end (legacy): result=${ok}`)).catch((e: Error) => console.error("[WhatsApp] charge_end (legacy) error:", e.message));
            }
          } catch (waErr: any) {
            console.error(`[WhatsApp] charge_end (legacy) exception:`, waErr?.message);
          }
        } catch (notifErr) {
          console.error(`[OCPP] Error sending charge complete notification:`, notifErr);
        }
      }
      
      ocpp16Transactions.delete(payload.transactionId);
      
      console.log(`[OCPP] StopTransaction - ${energyDelivered.toFixed(4)} kWh, Total: $${totalCost.toFixed(0)} COP (Investor: $${investorShare.toFixed(0)}, Platform: $${platformFee.toFixed(0)})`);
      
      return { idTagInfo: { status: "Accepted" } };
    }
    case "MeterValues": {
      // Procesar TODOS los valores de medición en tiempo real
      const transactionId = payload.transactionId;
      
      console.log(`[OCPP] MeterValues RECEIVED - ocppIdentity=${ocppIdentity}, stationId=${stationId}, transactionId=${transactionId}, payload=${JSON.stringify(payload).substring(0, 500)}`);
      
      // Importar funciones de sesión activa
      const { updateActiveSessionMeterData, getActiveSessionById, setActiveSession } = await import("../charging/charging-router");
      
      // === BUSCAR TRANSACCIÓN ===
      // Estrategia multi-nivel para encontrar la transacción correcta
      let transaction: any = null;
      
      // 1. Buscar por mapa de transacciones OCPP en memoria
      if (transactionId) {
        const internalTransactionId = ocpp16Transactions.get(transactionId);
        console.log(`[OCPP] MeterValues - Map lookup: ocppTxId=${transactionId}, internalId=${internalTransactionId || 'NOT_FOUND'}, mapSize=${ocpp16Transactions.size}, mapKeys=[${Array.from(ocpp16Transactions.keys()).join(',')}]`);
        
        if (internalTransactionId) {
          transaction = await db.getTransactionByOcppId(internalTransactionId);
          if (transaction) {
            console.log(`[OCPP] MeterValues - Found via map: dbTxId=${transaction.id}`);
          }
        }
        
        // 2. Si el cargador usa su propio transactionId, también guardar el mapeo
        if (!internalTransactionId && stationId) {
          // El cargador puede usar un ID diferente al que le asignamos
          // Intentar encontrar la transacción activa y crear el mapeo
          try {
            const activeTransactions = await db.getActiveTransactionsByStationId(stationId);
            if (activeTransactions && activeTransactions.length > 0) {
              transaction = activeTransactions[0];
              // Guardar mapeo para futuras búsquedas
              if (transaction.ocppTransactionId) {
                ocpp16Transactions.set(transactionId, transaction.ocppTransactionId);
                console.log(`[OCPP] MeterValues - Created new mapping: ocppTxId=${transactionId} -> internalId=${transaction.ocppTransactionId} (dbTxId=${transaction.id})`);
              }
            }
          } catch (err) {
            console.error(`[OCPP] MeterValues station fallback error:`, err);
          }
        }
      }
      
      // 3. Fallback final: buscar transacción activa por estación
      if (!transaction && stationId) {
        try {
          const activeTransactions = await db.getActiveTransactionsByStationId(stationId);
          if (activeTransactions && activeTransactions.length > 0) {
            transaction = activeTransactions[0];
            console.log(`[OCPP] MeterValues - Found via station fallback: dbTxId=${transaction.id}`);
          }
        } catch (err) {
          console.error(`[OCPP] MeterValues station fallback error:`, err);
        }
      }
      
      // 4. Fallback extremo: buscar por ocppIdentity si no tenemos stationId
      if (!transaction && !stationId) {
        try {
          const station = await db.getChargingStationByOcppIdentity(ocppIdentity);
          if (station) {
            stationId = station.id;
            const activeTransactions = await db.getActiveTransactionsByStationId(station.id);
            if (activeTransactions && activeTransactions.length > 0) {
              transaction = activeTransactions[0];
              console.log(`[OCPP] MeterValues - Found via ocppIdentity fallback: dbTxId=${transaction.id}, stationId=${station.id}`);
            }
          }
        } catch (err) {
          console.error(`[OCPP] MeterValues ocppIdentity fallback error:`, err);
        }
      }
      
      if (!transaction) {
        console.warn(`[OCPP] MeterValues - NO TRANSACTION FOUND for ocppIdentity=${ocppIdentity}, stationId=${stationId}, transactionId=${transactionId}`);
        return {};
      }
      
      if (payload.meterValue && payload.meterValue.length > 0) {
        // Extraer TODOS los measurands de los sampledValues
          let energyWh: number | null = null;
          let powerW: number | null = null;
          let soc: number | null = null;
          let voltage: number | null = null;
          let currentA: number | null = null;
          let temperature: number | null = null;
          
          for (const mv of payload.meterValue) {
            for (const sv of mv.sampledValue || []) {
              const measurand = sv.measurand || "Energy.Active.Import.Register";
              const value = parseFloat(sv.value);
              const unit = (sv.unit || "").toLowerCase();
              
              if (isNaN(value)) continue;
              
              // Energy.Active.Import.Register (Wh o kWh)
              if (measurand.includes("Energy.Active.Import") || measurand === "Energy.Active.Import.Register") {
                energyWh = unit === "kwh" ? value * 1000 : value; // Normalizar a Wh
              }
              // Power.Active.Import (W o kW)
              else if (measurand.includes("Power.Active.Import") || measurand === "Power.Active.Import") {
                powerW = unit === "kw" ? value * 1000 : value; // Normalizar a W
              }
              // SoC (State of Charge) - porcentaje de batería del vehículo
              else if (measurand === "SoC" || measurand.includes("SoC")) {
                soc = value; // Ya es porcentaje
              }
              // Voltage
              else if (measurand.includes("Voltage")) {
                voltage = value;
              }
              // Current.Import
              else if (measurand.includes("Current.Import")) {
                currentA = value;
              }
              // Temperature
              else if (measurand.includes("Temperature")) {
                temperature = value;
              }
              // Si no tiene measurand, asumir que es energía (OCPP 1.6 default)
              else if (!sv.measurand) {
                energyWh = unit === "kwh" ? value * 1000 : value;
              }
            }
          }
          
          console.log(`[OCPP] MeterValues raw - txId=${transactionId}: energy=${energyWh}Wh, power=${powerW}W, soc=${soc}%, voltage=${voltage}V, current=${currentA}A`);
          
          // Calcular kWh consumidos
          const meterStart = transaction.meterStart ? parseFloat(transaction.meterStart) : 0;
          let kwhConsumed = 0;
          if (energyWh !== null) {
            kwhConsumed = (energyWh - meterStart) / 1000;
            if (kwhConsumed < 0) kwhConsumed = 0; // Protección contra valores negativos
          }
          
          // Potencia en kW - si el cargador no envía Power, estimar por diferencia de energía
          let powerKw = powerW !== null ? powerW / 1000 : null;
          
          // Si no hay potencia reportada, estimar por diferencia de energía entre lecturas
          if (powerKw === null && energyWh !== null) {
            const activeSession = getActiveSessionById(transaction.id);
            if (activeSession && activeSession.lastMeterUpdate) {
              const timeDiffMs = Date.now() - activeSession.lastMeterUpdate.getTime();
              const timeDiffHours = timeDiffMs / (1000 * 3600);
              if (timeDiffHours > 0.001) { // Al menos ~3.6 segundos
                const prevEnergyKwh = activeSession.currentKwh;
                const energyDiffKwh = kwhConsumed - prevEnergyKwh;
                if (energyDiffKwh >= 0) {
                  powerKw = energyDiffKwh / timeDiffHours;
                  // Limitar a la potencia nominal del conector (máx 150 kW para ser razonable)
                  if (powerKw > 150) powerKw = 150;
                  console.log(`[OCPP] MeterValues - Estimated power: ${powerKw.toFixed(2)} kW (delta=${energyDiffKwh.toFixed(4)} kWh in ${(timeDiffMs/1000).toFixed(0)}s)`);
                }
              }
            } else if (!activeSession) {
              // Si no hay sesión activa en memoria, crearla automáticamente
              // Esto ocurre cuando el cargador inicia por su cuenta (sin pasar por startCharge del frontend)
              console.log(`[OCPP] MeterValues - Auto-creating active session for transaction ${transaction.id}`);
              const tariffData = transaction.tariffId ? await db.getTariffById(transaction.tariffId) : null;
              const effectivePrice = stationId ? await db.getEffectiveStationPrice(stationId) : null;
              // Priorizar precio dinámico guardado en la transacción
              const sessionPricePerKwh = (transaction as any).appliedPricePerKwh 
                ? parseFloat(String((transaction as any).appliedPricePerKwh))
                : (effectivePrice?.pricePerKwh || (tariffData ? parseFloat(tariffData.pricePerKwh) : 1800));
              
              // Intentar precargar datos del vehículo del usuario para manualSoc
              let autoManualSoc: number | null = null;
              let autoBatteryCapacity: number | null = null;
              try {
                const defaultVehicle = await db.getDefaultVehicle(transaction.userId);
                if (defaultVehicle?.batteryCapacityKwh) {
                  autoBatteryCapacity = parseFloat(defaultVehicle.batteryCapacityKwh);
                  console.log(`[OCPP] MeterValues - Auto-loaded vehicle battery capacity: ${autoBatteryCapacity} kWh from ${defaultVehicle.brand} ${defaultVehicle.model}`);
                }
              } catch (e) {
                console.error(`[OCPP] MeterValues - Error loading vehicle data:`, e);
              }
              
              // Restaurar chargeMode/targetValue desde la BD
              const restoredChargeMode = (transaction as any).chargeMode || "full_charge";
              const restoredTargetValue = (transaction as any).targetValue ? parseFloat(String((transaction as any).targetValue)) : 0;
              
              setActiveSession(transaction.id, {
                transactionId: transaction.id,
                userId: transaction.userId,
                stationId: transaction.stationId,
                connectorId: transaction.evseId,
                chargeMode: restoredChargeMode as "fixed_amount" | "percentage" | "full_charge",
                targetValue: restoredTargetValue,
                startTime: new Date(transaction.startTime),
                currentKwh: kwhConsumed,
                currentCost: 0,
                pricePerKwh: sessionPricePerKwh,
                soc: null,
                currentPower: 0,
                voltage: null,
                current: null,
                lastMeterUpdate: null,
                powerHistory: [],
                socTargetNotified: false,
                manualSoc: autoManualSoc,
                manualBatteryCapacityKwh: autoBatteryCapacity,
                lowPowerSince: null,
                chargeCompleteDetected: false,
                chargeCompleteNotified: false,
          autoStopSent: false,
                energyBasedSoc: null,
              });
            }
          }
          
          // Calcular costo parcial (energía + tiempo + sesión)
          const tariff = transaction.tariffId ? await db.getTariffById(transaction.tariffId) : null;
          // Priorizar precio dinámico guardado en la transacción
          const pricePerKwh = (transaction as any).appliedPricePerKwh 
            ? parseFloat(String((transaction as any).appliedPricePerKwh))
            : (tariff ? parseFloat(tariff.pricePerKwh) : 1800);
          const pricePerMinute = tariff ? parseFloat(tariff.pricePerMinute || "0") : 0;
          const sessionFee = tariff ? parseFloat(tariff.pricePerSession || "0") : 0;
          
          const startTime = new Date(transaction.startTime);
          const durationMinutes = (Date.now() - startTime.getTime()) / (1000 * 60);
          
          const energyCost = kwhConsumed * pricePerKwh;
          const timeCost = durationMinutes * pricePerMinute;
          const currentTotalCost = energyCost + timeCost + sessionFee;
          
          // Guardar en tabla meter_values de la BD
          try {
            await db.createMeterValue({
              transactionId: transaction.id,
              evseId: transaction.evseId,
              timestamp: new Date(),
              energyKwh: energyWh !== null ? (energyWh / 1000).toFixed(4) : null,
              powerKw: powerKw !== null ? powerKw.toFixed(2) : null,
              voltage: voltage !== null ? voltage.toFixed(2) : null,
              current: currentA !== null ? currentA.toFixed(2) : null,
              soc: soc !== null ? Math.round(soc) : null,
              temperature: temperature !== null ? temperature.toFixed(2) : null,
              context: "Sample.Periodic",
              measurand: "Energy.Active.Import.Register",
            });
          } catch (mvErr) {
            console.error(`[OCPP] Error saving MeterValue to DB:`, mvErr);
          }
          
          // Actualizar transacción con valores parciales
          if (energyWh !== null) {
            await db.updateTransaction(transaction.id, {
              kwhConsumed: kwhConsumed.toFixed(4),
              energyCost: energyCost.toFixed(2),
              timeCost: timeCost.toFixed(2),
              sessionCost: sessionFee.toFixed(2),
              totalCost: currentTotalCost.toFixed(2),
            });
          }
          
          // Actualizar sesión activa en memoria (para consultas en tiempo real del frontend)
          const updated = updateActiveSessionMeterData(transaction.id, {
            currentKwh: kwhConsumed,
            currentCost: currentTotalCost,
            soc: soc,
            currentPower: powerKw !== null ? powerKw : 0,
            voltage: voltage,
            current: currentA,
          });
          
          console.log(`[OCPP] MeterValues PROCESSED - txId=${transaction.id}: ${kwhConsumed.toFixed(4)} kWh, $${currentTotalCost.toFixed(0)} COP, SoC=${soc ?? 'N/A'}%, Power=${powerKw?.toFixed(1) ?? 'N/A'}kW, sessionUpdated=${updated}`);
          
          // Si la sesión no existía en memoria y no se creó arriba, crearla ahora
          if (!updated && energyWh !== null) {
            console.log(`[OCPP] MeterValues - Session not found for txId=${transaction.id}, creating now`);
            const tariffData = transaction.tariffId ? await db.getTariffById(transaction.tariffId) : null;
            const effectivePrice = stationId ? await db.getEffectiveStationPrice(stationId) : null;
            // Priorizar precio dinámico guardado en la transacción
            const sessionPricePerKwh = (transaction as any).appliedPricePerKwh 
              ? parseFloat(String((transaction as any).appliedPricePerKwh))
              : (effectivePrice?.pricePerKwh || (tariffData ? parseFloat(tariffData.pricePerKwh) : 1800));
            
            // Intentar precargar datos del vehículo del usuario
            let autoManualSoc2: number | null = null;
            let autoBatteryCapacity2: number | null = null;
            try {
              const defaultVehicle2 = await db.getDefaultVehicle(transaction.userId);
              if (defaultVehicle2?.batteryCapacityKwh) {
                autoBatteryCapacity2 = parseFloat(defaultVehicle2.batteryCapacityKwh);
                console.log(`[OCPP] MeterValues - Auto-loaded vehicle battery capacity (fallback): ${autoBatteryCapacity2} kWh`);
              }
            } catch (e) {
              console.error(`[OCPP] MeterValues - Error loading vehicle data (fallback):`, e);
            }
            
            // Restaurar chargeMode/targetValue desde la BD (fallback path)
            const restoredChargeMode2 = (transaction as any).chargeMode || "full_charge";
            const restoredTargetValue2 = (transaction as any).targetValue ? parseFloat(String((transaction as any).targetValue)) : 0;
            
            setActiveSession(transaction.id, {
              transactionId: transaction.id,
              userId: transaction.userId,
              stationId: transaction.stationId,
              connectorId: transaction.evseId,
              chargeMode: restoredChargeMode2 as "fixed_amount" | "percentage" | "full_charge",
              targetValue: restoredTargetValue2,
              startTime: new Date(transaction.startTime),
              currentKwh: kwhConsumed,
              currentCost: currentTotalCost,
              pricePerKwh: sessionPricePerKwh,
              soc: soc,
              currentPower: powerKw !== null ? powerKw : 0,
              voltage: voltage,
              current: currentA,
              lastMeterUpdate: new Date(),
              powerHistory: [{
                timestamp: Date.now(),
                power: powerKw !== null ? powerKw : 0,
                energy: kwhConsumed,
                soc: soc,
              }],
              socTargetNotified: false,
              manualSoc: autoManualSoc2,
              manualBatteryCapacityKwh: autoBatteryCapacity2,
              lowPowerSince: null,
              chargeCompleteDetected: false,
              chargeCompleteNotified: false,
          autoStopSent: false,
              energyBasedSoc: null,
            });
          }
          
          // ============================================================
          // NOTIFICACIÓN: SoC alcanzó el porcentaje objetivo del usuario
          // ============================================================
          if (soc !== null && transaction.userId) {
            const activeSessionInfo = getActiveSessionById(transaction.id);
            if (activeSessionInfo && !activeSessionInfo.socTargetNotified) {
              const targetPercentage = activeSessionInfo.chargeMode === "percentage" 
                ? activeSessionInfo.targetValue 
                : 100;
              
              if (soc >= targetPercentage) {
                // Marcar como notificado para no enviar múltiples veces
                activeSessionInfo.socTargetNotified = true;
                
                const notificationKey = `soc_target_reached_${transaction.id}`;
                const existingNotification = await db.getNotificationByKey(transaction.userId, notificationKey);
                
                if (!existingNotification) {
                  await db.createNotification({
                    userId: transaction.userId,
                    type: "soc_target_reached",
                    title: `🔋 ¡Batería al ${soc}%! Objetivo alcanzado`,
                    message: `Tu vehículo ha alcanzado el ${soc}% de carga (objetivo: ${targetPercentage}%). Puedes desconectar cuando lo desees.`,
                    data: JSON.stringify({
                      transactionId: transaction.id,
                      soc,
                      targetPercentage,
                      key: notificationKey,
                    }),
                  });
                  console.log(`[OCPP] SoC target notification sent: user=${transaction.userId}, soc=${soc}%, target=${targetPercentage}%`);
                }
              }
            }
          }
          
          // Verificar saldo bajo del usuario usando la tabla wallets (no user.walletBalance que no existe)
          if (transaction.userId && energyWh !== null) {
            try {
              const userWallet = await db.getWalletByUserId(transaction.userId);
              if (userWallet) {
                const walletBalance = parseFloat(userWallet.balance) || 0;
                const remainingBalance = walletBalance - currentTotalCost;
                
                // Si el saldo restante es menor al 20% del costo actual, enviar alerta (una sola vez)
                if (remainingBalance < currentTotalCost * 0.2 && remainingBalance > 0) {
                  const notificationKey = `low_balance_${transaction.id}`;
                  const existingNotification = await db.getNotificationByKey(transaction.userId, notificationKey);
                  
                  if (!existingNotification) {
                    await db.createNotification({
                      userId: transaction.userId,
                      type: "low_balance",
                      title: "⚠️ Saldo bajo durante la carga",
                      message: `Tu saldo restante es $${remainingBalance.toFixed(0)} COP. Considera recargar para evitar interrupciones.`,
                      data: JSON.stringify({ 
                        transactionId: transaction.id,
                        remainingBalance,
                        currentCost: currentTotalCost,
                        key: notificationKey
                      }),
                    });
                    console.log(`[OCPP] Low balance alert sent to user ${transaction.userId}: $${remainingBalance.toFixed(0)} remaining`);
                  }
                }
                
                // Si el saldo llega a 0, enviar alerta (una sola vez, el BalanceMonitor se encarga de detener la carga)
                if (remainingBalance <= 0) {
                  const depletedKey = `balance_depleted_${transaction.id}`;
                  const existingDepleted = await db.getNotificationByKey(transaction.userId, depletedKey);
                  
                  if (!existingDepleted) {
                    console.log(`[OCPP] User ${transaction.userId} balance depleted (wallet: $${walletBalance}, cost: $${currentTotalCost.toFixed(0)})`);
                    await db.createNotification({
                      userId: transaction.userId,
                      type: "balance_depleted",
                      title: "⚠️ Saldo insuficiente",
                      message: `Tu saldo de $${walletBalance.toLocaleString()} COP no cubre el costo actual de $${currentTotalCost.toFixed(0)} COP. Recarga tu billetera para evitar interrupciones.`,
                      data: JSON.stringify({ transactionId: transaction.id, key: depletedKey }),
                    });
                  }
                  // El BalanceMonitor (cada 30s) se encarga de intentar auto-recarga y detener si es necesario
                }
              }
            } catch (balanceErr) {
              console.warn(`[OCPP] Error checking balance for user ${transaction.userId}:`, balanceErr);
            }
          }
        }
      }
      return {};
    case "DataTransfer": {
      return { status: "Accepted" };
    }
    default: {
      console.log(`[OCPP] Unknown 1.6 action: ${action}`);
      return {};
    }
  }
}

// Handler para mensajes OCPP 2.0.1
async function handleOCPP201Message(
  action: string,
  payload: any,
  ocppIdentity: string,
  stationId: number | null,
  db: any
): Promise<any> {
  switch (action) {
    case "BootNotification": {
      let station = await db.getChargingStationByOcppIdentity(ocppIdentity);
      if (station) {
        await db.updateChargingStation(station.id, {
          isOnline: true,
          manufacturer: payload.chargingStation?.vendorName,
          model: payload.chargingStation?.model,
          serialNumber: payload.chargingStation?.serialNumber,
          firmwareVersion: payload.chargingStation?.firmwareVersion,
          lastBootNotification: new Date(),
        });
      }
      return {
        currentTime: new Date().toISOString(),
        interval: 30, // Heartbeat cada 30s para mantener proxy activo (era 60)
        status: station ? "Accepted" : "Pending",
        _stationId: station?.id,
      };
    }
    case "Heartbeat": {
      return { currentTime: new Date().toISOString() };
    }
    case "StatusNotification": {
      if (stationId) {
        const evses = await db.getEvsesByStationId(stationId);
        const evse = evses.find((e: any) => e.evseIdLocal === payload.evseId);
        if (evse) {
          const statusMap: Record<string, string> = {
            Available: "AVAILABLE",
            Occupied: "CHARGING",
            Reserved: "RESERVED",
            Unavailable: "UNAVAILABLE",
            Faulted: "FAULTED",
          };
          const newStatus = statusMap[payload.connectorStatus] || "UNAVAILABLE";
          
          // PROTECCIÓN: No sobreescribir RESERVED
          if (evse.status === "RESERVED" && newStatus !== "RESERVED" && newStatus !== "CHARGING") {
            console.log(`[OCPP 2.0.1] StatusNotification - Skipping: EVSE ${evse.id} is RESERVED`);
          } else {
            await db.updateEvseStatus(evse.id, newStatus);
          }
          
          // OVERSTAY: En OCPP 2.0.1, "Occupied" con connectorStatus puede indicar Finishing
          // También manejar Available para finalizar overstay
          if (payload.connectorStatus === "Available") {
            onCableDisconnected(evse.id).catch(err => 
              console.error(`[OCPP 2.0.1] Error finalizing overstay:`, err)
            );
          }
        }
      }
      return {};
    }
    case "TransactionEvent": {
      return { idTokenInfo: { status: "Accepted" } };
    }
    case "Authorize": {
      return { idTokenInfo: { status: "Accepted" } };
    }
    default: {
      console.log(`[OCPP] Unknown 2.0.1 action: ${action}`);
      return {};
    }
  }
}

// ============================================
// CRITICAL: Process-level error handlers
// Without these, ANY uncaught error kills the process silently
// and the hosting marks the service as "disabled" (503)
// ============================================

// Catch unhandled promise rejections (e.g., failed DB queries in background jobs)
process.on('unhandledRejection', (reason, promise) => {
  console.error('[PROCESS] Unhandled Promise Rejection:', reason);
  console.error('[PROCESS] Promise:', promise);
  // Do NOT exit - keep the server running
});

// Catch uncaught exceptions (e.g., thrown errors in setInterval callbacks)
process.on('uncaughtException', (error) => {
  console.error('[PROCESS] Uncaught Exception:', error);
  console.error('[PROCESS] Stack:', error.stack);
  // Do NOT exit - keep the server running
  // The error is logged and the process continues
});

// Graceful shutdown on SIGTERM (hosting sends this before killing)
let isShuttingDown = false;
process.on('SIGTERM', () => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('[PROCESS] SIGTERM received. Graceful shutdown starting...');
  // Give 10 seconds for in-flight requests to complete
  setTimeout(() => {
    console.log('[PROCESS] Graceful shutdown complete. Exiting.');
    process.exit(0);
  }, 10000);
});

process.on('SIGINT', () => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('[PROCESS] SIGINT received. Shutting down...');
  setTimeout(() => process.exit(0), 5000);
});

// ============================================
// Memory monitoring - log warnings when heap grows too large
// ============================================
setInterval(() => {
  const mem = process.memoryUsage();
  const heapMB = Math.round(mem.heapUsed / 1024 / 1024);
  const rssMB = Math.round(mem.rss / 1024 / 1024);
  
  if (heapMB > 400) {
    console.warn(`[PROCESS] HIGH MEMORY WARNING: heap=${heapMB}MB, rss=${rssMB}MB`);
    // Force garbage collection if available
    if (global.gc) {
      console.log('[PROCESS] Running forced garbage collection...');
      global.gc();
    }
  }
}, 5 * 60 * 1000); // Check every 5 minutes

// ============================================
// Internal Auto-Ping Keep-Alive
// Pings /api/health every 4 minutes to prevent the hosting
// platform from marking the service as inactive/sleeping.
// This generates regular HTTP traffic that resets inactivity timers.
// ============================================
let keepAliveFailures = 0;
const KEEP_ALIVE_INTERVAL = 4 * 60 * 1000; // 4 minutes
const KEEP_ALIVE_MAX_FAILURES = 5;

function startKeepAlive() {
  const port = process.env.PORT || 3000;
  const keepAliveUrl = `http://localhost:${port}/api/health`;
  
  setInterval(async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout
      
      const response = await fetch(keepAliveUrl, {
        signal: controller.signal,
        headers: { 'X-Keep-Alive': 'internal' },
      });
      clearTimeout(timeout);
      
      if (response.ok) {
        keepAliveFailures = 0;
        // Log only every 15th ping (~1 hour) to avoid log spam
        const now = new Date();
        if (now.getMinutes() % 60 < 4) {
          const mem = process.memoryUsage();
          console.log(`[KeepAlive] OK - uptime=${Math.round(process.uptime())}s, heap=${Math.round(mem.heapUsed / 1024 / 1024)}MB, rss=${Math.round(mem.rss / 1024 / 1024)}MB`);
        }
      } else {
        keepAliveFailures++;
        console.warn(`[KeepAlive] WARN: Health check returned ${response.status} (failure ${keepAliveFailures}/${KEEP_ALIVE_MAX_FAILURES})`);
      }
    } catch (error: any) {
      keepAliveFailures++;
      console.error(`[KeepAlive] ERROR: ${error.message || error} (failure ${keepAliveFailures}/${KEEP_ALIVE_MAX_FAILURES})`);
      
      // If too many consecutive failures, the server might be in a bad state
      if (keepAliveFailures >= KEEP_ALIVE_MAX_FAILURES) {
        console.error(`[KeepAlive] CRITICAL: ${KEEP_ALIVE_MAX_FAILURES} consecutive failures. Server may be unresponsive.`);
        keepAliveFailures = 0; // Reset counter to keep trying
      }
    }
  }, KEEP_ALIVE_INTERVAL);
  
  console.log(`[KeepAlive] Internal keep-alive started (every ${KEEP_ALIVE_INTERVAL / 1000}s → ${keepAliveUrl})`);
}

// Start keep-alive after server is up (delay 30s to let everything initialize)
setTimeout(() => {
  startKeepAlive();
}, 30000);

startServer().catch((err) => {
  console.error('[PROCESS] Failed to start server:', err);
  // Retry after 5 seconds
  setTimeout(() => {
    console.log('[PROCESS] Retrying server start...');
    startServer().catch((err2) => {
      console.error('[PROCESS] Second start attempt failed:', err2);
      process.exit(1);
    });
  }, 5000);
});
