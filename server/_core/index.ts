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
      if (stationId && payload.connectorId > 0) {
        const evses = await db.getEvsesByStationId(stationId);
        const evse = evses.find((e: any) => e.evseIdLocal === payload.connectorId);
        if (evse) {
          const statusMap: Record<string, string> = {
            Available: "AVAILABLE",
            Preparing: "AVAILABLE",
            Charging: "CHARGING",
            SuspendedEV: "CHARGING",
            SuspendedEVSE: "CHARGING",
            Finishing: "CHARGING",
            Reserved: "RESERVED",
            Unavailable: "UNAVAILABLE",
            Faulted: "FAULTED",
          };
          await db.updateEvseStatus(evse.id, statusMap[payload.status] || "UNAVAILABLE");
        }
      }
      return {};
    }
    case "Authorize": {
      // Validar idTag contra la base de datos de usuarios
      const idTag = payload.idTag;
      if (idTag) {
        const user = await db.getUserByIdTag(idTag);
        if (user && user.isActive) {
          console.log(`[OCPP] Authorize - User ${user.name || user.email} (ID: ${user.id}) authorized with idTag: ${idTag}`);
          return {
            idTagInfo: {
              status: "Accepted",
              expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
              parentIdTag: user.id.toString(),
            },
          };
        } else if (user && !user.isActive) {
          console.log(`[OCPP] Authorize - User with idTag ${idTag} is blocked`);
          return {
            idTagInfo: {
              status: "Blocked",
            },
          };
        } else {
          console.log(`[OCPP] Authorize - Unknown idTag: ${idTag}`);
          return {
            idTagInfo: {
              status: "Invalid",
            },
          };
        }
      }
      // Si no hay idTag, rechazar
      return {
        idTagInfo: {
          status: "Invalid",
        },
      };
    }
    case "StartTransaction": {
      if (!stationId) {
        return { idTagInfo: { status: "Invalid" }, transactionId: 0 };
      }
      const evses = await db.getEvsesByStationId(stationId);
      const evse = evses.find((e: any) => e.evseIdLocal === payload.connectorId);
      if (!evse) {
        return { idTagInfo: { status: "Invalid" }, transactionId: 0 };
      }
      
      // Buscar usuario por idTag
      const idTag = payload.idTag;
      let userId: number | null = null;
      let userName = "Usuario";
      
      if (idTag) {
        const user = await db.getUserByIdTag(idTag);
        if (user && user.isActive) {
          userId = user.id;
          userName = user.name || user.email || "Usuario";
          console.log(`[OCPP] StartTransaction - User ${userName} (ID: ${userId}) starting charge with idTag: ${idTag}`);
        } else if (user && !user.isActive) {
          console.log(`[OCPP] StartTransaction - User with idTag ${idTag} is blocked`);
          return { idTagInfo: { status: "Blocked" }, transactionId: 0 };
        } else {
          console.log(`[OCPP] StartTransaction - Unknown idTag: ${idTag}, transaction will be anonymous`);
        }
      }
      
      const tariff = await db.getActiveTariffByStationId(stationId);
      const { nanoid } = await import("nanoid");
      const internalTransactionId = nanoid();
      
      await db.createTransaction({
        evseId: evse.id,
        userId: userId || 1, // Usar usuario encontrado o fallback a 1 (admin)
        stationId,
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
          const station = await db.getChargingStationById(stationId);
          const stationName = station?.name || "Estación";
          const pricePerKwh = tariff ? parseFloat(tariff.pricePerKwh) : 1800;
          await db.createNotification({
            userId: userId,
            title: "🔌 Carga iniciada",
            message: `Hola ${userName}, tu carga ha comenzado en ${stationName}. Tarifa actual: $${pricePerKwh.toLocaleString()} COP/kWh. Te notificaremos cuando finalice.`,
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
      const internalTransactionId = ocpp16Transactions.get(payload.transactionId);
      if (!internalTransactionId) {
        return { idTagInfo: { status: "Invalid" } };
      }
      const transaction = await db.getTransactionByOcppId(internalTransactionId);
      if (!transaction) {
        return { idTagInfo: { status: "Invalid" } };
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
      
      // Costo de sesión fijo (si aplica)
      const sessionFee = tariff ? parseFloat(tariff.sessionFee || "0") : 0;
      
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
      // Procesar valores de medición en tiempo real
      const transactionId = payload.transactionId;
      if (transactionId) {
        const internalTransactionId = ocpp16Transactions.get(transactionId);
        if (internalTransactionId) {
          const transaction = await db.getTransactionByOcppId(internalTransactionId);
          if (transaction && payload.meterValue && payload.meterValue.length > 0) {
            // Buscar el valor de energía activa importada
            for (const mv of payload.meterValue) {
              for (const sv of mv.sampledValue || []) {
                if (sv.measurand === "Energy.Active.Import.Register" || !sv.measurand) {
                  const currentMeter = parseFloat(sv.value);
                  const meterStart = transaction.meterStart ? parseFloat(transaction.meterStart) : 0;
                  const kwhConsumed = (currentMeter - meterStart) / 1000;
                  
                  // Calcular costo parcial
                  const tariff = transaction.tariffId ? await db.getTariffById(transaction.tariffId) : null;
                  const pricePerKwh = tariff ? parseFloat(tariff.pricePerKwh) : 1800;
                  const currentCost = kwhConsumed * pricePerKwh;
                  
                  // Actualizar transacción con valores parciales
                  await db.updateTransaction(transaction.id, {
                    kwhConsumed: kwhConsumed.toFixed(4),
                    energyCost: currentCost.toFixed(2),
                    totalCost: currentCost.toFixed(2),
                  });
                  
                  console.log(`[OCPP] MeterValues - Transaction ${transactionId}: ${kwhConsumed.toFixed(4)} kWh, $${currentCost.toFixed(0)} COP`);
                  
                  // Verificar saldo bajo del usuario
                  if (transaction.userId) {
                    const user = await db.getUserById(transaction.userId);
                    if (user) {
                      const userBalance = parseFloat(user.walletBalance || "0");
                      const remainingBalance = userBalance - currentCost;
                      
                      // Si el saldo restante es menor al 20% del costo actual, enviar alerta
                      if (remainingBalance < currentCost * 0.2 && remainingBalance > 0) {
                        // Verificar si ya enviamos esta notificación (evitar spam)
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
                              currentCost,
                              key: notificationKey
                            }),
                          });
                          console.log(`[OCPP] Low balance alert sent to user ${user.id}: $${remainingBalance.toFixed(0)} remaining`);
                        }
                      }
                      
                      // Si el saldo llega a 0, detener la carga
                      if (remainingBalance <= 0) {
                        console.log(`[OCPP] User ${user.id} balance depleted, stopping charge`);
                        // Enviar notificación de saldo agotado
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
                  
                  break;
                }
              }
            }
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
