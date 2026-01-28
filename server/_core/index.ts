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
  // Endpoint de verificación OCPP (HTTP) - debe ir antes de los archivos estáticos
  app.get("/ocpp/status", (req, res) => {
    res.json({
      status: "online",
      message: "OCPP WebSocket server is running",
      endpoint: "wss://" + req.headers.host + "/ocpp/{chargePointId}",
      supportedProtocols: ["ocpp1.6", "ocpp2.0.1"],
      timestamp: new Date().toISOString()
    });
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
    handleProtocols: (protocols: Set<string>) => {
      // Priorizar OCPP 2.0.1, pero aceptar 1.6J si es lo único disponible
      if (protocols.has("ocpp2.0.1")) return "ocpp2.0.1";
      if (protocols.has("ocpp2.0")) return "ocpp2.0";
      if (protocols.has("ocpp1.6")) return "ocpp1.6";
      return "ocpp1.6"; // Default para compatibilidad máxima
    }
  });

  // Manejar upgrade de HTTP a WebSocket para rutas OCPP
  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url || "", `http://${request.headers.host}`);
    
    // Solo manejar rutas que empiecen con /ocpp/
    if (url.pathname.startsWith("/ocpp/")) {
      console.log(`[OCPP] Upgrade request for: ${url.pathname}`);
      
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else {
      // No es una ruta OCPP, cerrar la conexión
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

    console.log(`[OCPP] New ${ocppVersion} connection from: ${ocppIdentity}`);
    console.log(`[OCPP] URL: ${req.url}, Protocol: ${protocol}`);

    // Delegar al manejador del CSMS
    handleOCPPConnection(ws, ocppIdentity, ocppVersion);
  });

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    console.log(`OCPP WebSocket endpoint: ws://localhost:${port}/ocpp/{chargePointId}`);
  });
}

// Función para manejar conexiones OCPP
function handleOCPPConnection(ws: WebSocket, ocppIdentity: string, ocppVersion: string) {
  // Importar dinámicamente para evitar dependencias circulares
  import("../db").then(async (db) => {
    // Mapeo de transacciones OCPP 1.6 a IDs internos
    const ocpp16Transactions = new Map<number, string>();
    let transactionIdCounter = 1;

    // Registrar conexión
    let stationId: number | null = null;

    await db.createOcppLog({
      ocppIdentity,
      direction: "IN",
      messageType: "CONNECTION",
      payload: { ocppVersion },
    });

    ws.on("message", async (data) => {
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
      if (stationId) {
        await db.updateStationOnlineStatus(ocppIdentity, false);
      }
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
  });
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
      return {
        idTagInfo: {
          status: "Accepted",
          expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
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
      const tariff = await db.getActiveTariffByStationId(stationId);
      const { nanoid } = await import("nanoid");
      const internalTransactionId = nanoid();
      
      await db.createTransaction({
        evseId: evse.id,
        userId: 1,
        stationId,
        tariffId: tariff?.id,
        ocppTransactionId: internalTransactionId,
        startTime: new Date(payload.timestamp),
        status: "IN_PROGRESS",
        meterStart: String(payload.meterStart),
      });
      
      ocpp16Transactions.set(transactionIdCounter, internalTransactionId);
      await db.updateEvseStatus(evse.id, "CHARGING");
      
      return {
        idTagInfo: { status: "Accepted" },
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
      const totalCost = energyDelivered * pricePerKwh;
      
      await db.updateTransaction(transaction.id, {
        endTime: new Date(payload.timestamp),
        meterEnd: String(payload.meterStop),
        kwhConsumed: energyDelivered.toString(),
        totalCost: totalCost.toString(),
        status: "COMPLETED",
        stopReason: payload.reason,
      });
      await db.updateEvseStatus(transaction.evseId, "AVAILABLE");
      ocpp16Transactions.delete(payload.transactionId);
      
      return { idTagInfo: { status: "Accepted" } };
    }
    case "MeterValues": {
      // Procesar valores de medición
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
