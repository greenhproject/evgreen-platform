import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { WebSocketServer, WebSocket } from "ws";
import { handleStripeWebhook } from "../stripe/webhook";
import { handleWompiWebhook } from "../wompi/webhook";
import { startBillingCronJob } from "../wompi/recurring-billing";
import { startTransactionCleanupJob } from "../jobs/transaction-cleanup";
import { startBalanceMonitor } from "../charging/balance-monitor";
import * as ocppManager from "../ocpp/connection-manager";
import * as alertsService from "../ocpp/alerts-service";

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
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // Stripe webhook - DEBE ir ANTES de express.json() para verificación de firma
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), handleStripeWebhook);
  // Wompi webhook
  app.post("/api/wompi/webhook", express.json(), handleWompiWebhook);
  
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
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

  // Ping/Pong para mantener conexiones vivas (cada 30 segundos)
  const pingInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if ((ws as any).isAlive === false) {
        console.log(`[OCPP] Terminating inactive connection`);
        return ws.terminate();
      }
      (ws as any).isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on("close", () => {
    clearInterval(pingInterval);
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
      
      // Enviar headers de respuesta manualmente para mejor compatibilidad con proxies
      wss.handleUpgrade(request, socket, head, (ws) => {
        console.log(`[OCPP] Upgrade successful, emitting connection`);
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
    // Marcar conexión como viva para ping/pong
    (ws as any).isAlive = true;
    ws.on("pong", () => {
      (ws as any).isAlive = true;
    });

    const url = new URL(req.url || "", `http://${req.headers.host}`);
    // El chargePointId viene después de /ocpp/
    const pathParts = url.pathname.split("/").filter(Boolean);
    const ocppIdentity = pathParts[pathParts.length - 1] || "";
    const protocol = ws.protocol || "ocpp1.6";
    const ocppVersion = protocol.includes("2.0") ? "2.0.1" : "1.6";

    console.log(`[OCPP] New ${ocppVersion} connection established:`, {
      identity: ocppIdentity,
      url: req.url,
      protocol: protocol,
      remoteAddress: req.socket?.remoteAddress,
    });

    // Delegar al manejador del CSMS
    handleOCPPConnection(ws, ocppIdentity, ocppVersion);
  });

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    console.log(`OCPP WebSocket endpoint: ws://localhost:${port}/ocpp/{chargePointId}`);
    
    // Iniciar cron job de cobro recurrente de suscripciones
    startBillingCronJob();
    
    // Iniciar limpieza periódica de transacciones huérfanas (cada 15 minutos)
    startTransactionCleanupJob();
    
    // Iniciar monitoreo de saldo durante cargas activas (cada 30s)
    startBalanceMonitor();
  });
}

// Función para manejar conexiones OCPP
async function handleOCPPConnection(ws: WebSocket, ocppIdentity: string, ocppVersion: string) {
  // Importar db al inicio
  const db = await import("../db");
  
  // Registrar en el connection manager
  const connection = ocppManager.registerConnection(ocppIdentity, ws, ocppVersion);
  
  // Mapeo de transacciones OCPP 1.6 a IDs internos
  const ocpp16Transactions = new Map<number, string>();
  let transactionIdCounter = 1;

  // Registrar conexión
  let stationId: number | null = null;

  // PRE-RESOLVER stationId inmediatamente al conectarse (no esperar a BootNotification)
  try {
    const station = await db.getChargingStationByOcppIdentity(ocppIdentity);
    if (station) {
      stationId = station.id;
      console.log(`[OCPP] Pre-resolved stationId=${stationId} for ${ocppIdentity} at connection time`);
      // Marcar como online
      await db.updateStationOnlineStatus(ocppIdentity, true);
    } else {
      console.warn(`[OCPP] Could not pre-resolve stationId for ${ocppIdentity} - station not found in DB`);
    }
  } catch (err) {
    console.error(`[OCPP] Error pre-resolving stationId for ${ocppIdentity}:`, err);
  }

  // Registrar el event listener PRIMERO, antes de cualquier operación async
  ws.on("message", async (data) => {
      // Actualizar timestamp de último mensaje
      ocppManager.updateLastMessage(ocppIdentity);
      try {
        const message = JSON.parse(data.toString());
        const messageType = message[0];

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
                console.log(`[OCPP] Auto-resolved stationId=${stationId} for ${ocppIdentity} in handleMessage`);
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

    ws.on("close", async () => {
      console.log(`[OCPP] Connection closed: ${ocppIdentity}`);
      
      // Remover del connection manager
      ocppManager.removeConnection(ocppIdentity);
      
      if (stationId) {
        await db.updateStationOnlineStatus(ocppIdentity, false);
      }
      
      // Generar alerta de desconexión
      alertsService.handleDisconnection(ocppIdentity, stationId ?? undefined)
        .catch(err => console.error("[OCPP Alert] Error:", err));
      
      await db.createOcppLog({
        ocppIdentity,
        stationId,
        direction: "IN",
        messageType: "DISCONNECTION",
        payload: {},
      });
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
        interval: 60,
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
          await db.updateEvseStatus(evse.id, newStatus);
          console.log(`[OCPP] StatusNotification - Updated EVSE ${evse.id} to ${newStatus} (OCPP: ${payload.status})`);
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
      
      await db.createTransaction({
        evseId: evse.id,
        userId: userId || 1, // Usar usuario encontrado o fallback a 1 (admin)
        stationId: resolvedStId,
        tariffId: tariff?.id,
        ocppTransactionId: internalTransactionId,
        startTime: new Date(payload.timestamp),
        status: "IN_PROGRESS",
        meterStart: String(payload.meterStart),
      });
      
      ocpp16Transactions.set(transactionIdCounter, internalTransactionId);
      await db.updateEvseStatus(evse.id, "CHARGING");
      
      // Enviar notificación al usuario cuando inicia la carga
      if (userId) {
        try {
          const station = await db.getChargingStationById(resolvedStId);
          const stationName = station?.name || "Estación";
          // Usar precio efectivo dinámico en vez del precio base de la tarifa
          const effectivePrice = await db.getEffectiveStationPrice(resolvedStId);
          const effectivePricePerKwh = effectivePrice.pricePerKwh;
          const formattedPrice = Math.round(effectivePricePerKwh).toLocaleString("es-CO");
          await db.createNotification({
            userId: userId,
            title: "Carga iniciada",
            message: `Hola ${userName}, tu carga ha comenzado en ${stationName}. Tarifa: $${formattedPrice} COP/kWh. Te notificaremos cuando finalice.`,
            type: "CHARGE_START",
            referenceId: null,
            referenceType: "transaction",
          });
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
      const pricePerKwh = tariff ? parseFloat(tariff.pricePerKwh) : 1800;
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
      
      // Actualizar estado del EVSE
      await db.updateEvseStatus(transaction.evseId, "AVAILABLE");
      
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
      
      // Importar updateActiveSessionMeterData para actualizar sesión en memoria
      const { updateActiveSessionMeterData } = await import("../charging/charging-router");
      
      if (transactionId) {
        const internalTransactionId = ocpp16Transactions.get(transactionId);
        let transaction: any = null;
        
        if (internalTransactionId) {
          transaction = await db.getTransactionByOcppId(internalTransactionId);
        }
        
        // Fallback: buscar transacción activa por estación si no se encuentra por mapa
        if (!transaction && stationId) {
          try {
            const activeTransactions = await db.getActiveTransactionsByStationId(stationId);
            if (activeTransactions && activeTransactions.length > 0) {
              transaction = activeTransactions[0];
              console.log(`[OCPP] MeterValues - Found transaction via station fallback: txId=${transaction.id}`);
            }
          } catch (err) {
            console.error(`[OCPP] MeterValues station fallback error:`, err);
          }
        }
        
        if (transaction && payload.meterValue && payload.meterValue.length > 0) {
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
          
          // Potencia en kW
          const powerKw = powerW !== null ? powerW / 1000 : null;
          
          // Calcular costo parcial (energía + tiempo + sesión)
          const tariff = transaction.tariffId ? await db.getTariffById(transaction.tariffId) : null;
          const pricePerKwh = tariff ? parseFloat(tariff.pricePerKwh) : 1800;
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
          updateActiveSessionMeterData(transaction.id, {
            currentKwh: kwhConsumed,
            currentCost: currentTotalCost,
            soc: soc,
            currentPower: powerKw !== null ? powerKw : 0,
            voltage: voltage,
            current: currentA,
          });
          
          console.log(`[OCPP] MeterValues - Transaction ${transactionId}: ${kwhConsumed.toFixed(4)} kWh, $${currentTotalCost.toFixed(0)} COP, SoC=${soc ?? 'N/A'}%, Power=${powerKw?.toFixed(1) ?? 'N/A'}kW`);
          
          // Verificar saldo bajo del usuario
          if (transaction.userId && energyWh !== null) {
            const user = await db.getUserById(transaction.userId);
            if (user) {
              const userBalance = parseFloat(user.walletBalance || "0");
              const remainingBalance = userBalance - currentTotalCost;
              
              // Si el saldo restante es menor al 20% del costo actual, enviar alerta
              if (remainingBalance < currentTotalCost * 0.2 && remainingBalance > 0) {
                const notificationKey = `low_balance_${transaction.id}`;
                const existingNotification = await db.getNotificationByKey(user.id, notificationKey);
                
                if (!existingNotification) {
                  await db.createNotification({
                    userId: user.id,
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
                  console.log(`[OCPP] Low balance alert sent to user ${user.id}: $${remainingBalance.toFixed(0)} remaining`);
                }
              }
              
              // Si el saldo llega a 0, detener la carga
              if (remainingBalance <= 0) {
                console.log(`[OCPP] User ${user.id} balance depleted, stopping charge`);
                await db.createNotification({
                  userId: user.id,
                  type: "balance_depleted",
                  title: "🛑 Carga detenida - Saldo agotado",
                  message: `Tu saldo se ha agotado. La carga se detuvo automáticamente. Recarga tu billetera para continuar.`,
                  data: JSON.stringify({ transactionId: transaction.id }),
                });
                // TODO: Enviar RemoteStopTransaction al cargador
              }
            }
          }
        }
      } else {
        // MeterValues sin transactionId - puede ser un reporte periódico del conector
        // Intentar encontrar transacción activa por estación
        if (stationId && payload.meterValue && payload.meterValue.length > 0) {
          try {
            const activeTransactions = await db.getActiveTransactionsByStationId(stationId);
            if (activeTransactions && activeTransactions.length > 0) {
              const transaction = activeTransactions[0];
              
              for (const mv of payload.meterValue) {
                for (const sv of mv.sampledValue || []) {
                  const measurand = sv.measurand || "";
                  const value = parseFloat(sv.value);
                  if (isNaN(value)) continue;
                  
                  const unit = (sv.unit || "").toLowerCase();
                  let soc: number | null = null;
                  let powerKw: number | null = null;
                  
                  if (measurand === "SoC" || measurand.includes("SoC")) {
                    soc = value;
                  } else if (measurand.includes("Power.Active.Import")) {
                    powerKw = unit === "kw" ? value : value / 1000;
                  }
                  
                  if (soc !== null || powerKw !== null) {
                    updateActiveSessionMeterData(transaction.id, {
                      ...(soc !== null ? { soc } : {}),
                      ...(powerKw !== null ? { currentPower: powerKw } : {}),
                    });
                  }
                }
              }
            }
          } catch (err) {
            console.error(`[OCPP] MeterValues (no txId) station fallback error:`, err);
          }
        }
      }
      return {};
    }
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
        interval: 60,
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
          await db.updateEvseStatus(evse.id, statusMap[payload.connectorStatus] || "UNAVAILABLE");
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

startServer().catch(console.error);
