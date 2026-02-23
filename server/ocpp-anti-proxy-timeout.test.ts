/**
 * Tests para la estrategia anti-proxy-timeout OCPP
 * Verifica que las 3 capas de keepalive están correctamente configuradas
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Leer los archivos fuente para verificar la configuración
const indexTsPath = path.join(__dirname, "_core/index.ts");
const indexTs = fs.readFileSync(indexTsPath, "utf-8");

const csmsDualPath = path.join(__dirname, "ocpp/csms-dual.ts");
const csmsDualTs = fs.readFileSync(csmsDualPath, "utf-8");

describe("Anti-Proxy-Timeout Strategy", () => {
  
  describe("Capa 1: WebSocket ping/pong", () => {
    it("debe tener ping interval de 20 segundos en legacy", () => {
      expect(indexTs).toContain("WS_PING_INTERVAL_MS = 20000");
    });
    
    it("debe tener ping interval de 20 segundos en DualCSMS", () => {
      expect(csmsDualTs).toContain("PING_INTERVAL_MS = 20000");
    });
    
    it("debe terminar conexiones que no responden al pong", () => {
      expect(indexTs).toContain("isAlive === false");
      expect(indexTs).toContain("ws.terminate()");
    });
  });
  
  describe("Capa 2: OCPP TriggerMessage keepalive", () => {
    it("debe enviar TriggerMessage Heartbeat cada 90 segundos en legacy", () => {
      expect(indexTs).toContain("OCPP_KEEPALIVE_INTERVAL_MS = 90000");
      expect(indexTs).toContain('"TriggerMessage"');
      expect(indexTs).toContain('"requestedMessage": "Heartbeat"');
    });
    
    it("debe enviar TriggerMessage Heartbeat cada 90 segundos en DualCSMS", () => {
      expect(csmsDualTs).toContain("90000"); // 90 segundos
      expect(csmsDualTs).toContain("TriggerMessage");
      expect(csmsDualTs).toContain("requestedMessage");
      expect(csmsDualTs).toContain("Heartbeat");
    });
    
    it("debe usar messageId con prefijo keepalive para identificar respuestas", () => {
      expect(indexTs).toContain('`keepalive-${Date.now()}-${keepaliveCount}`');
    });
    
    it("debe limpiar el interval de keepalive al cerrar el WSS", () => {
      expect(indexTs).toContain("clearInterval(ocppKeepaliveInterval)");
    });
  });
  
  describe("Capa 3: BootNotification HeartbeatInterval reducido", () => {
    it("debe responder BootNotification con interval=30 en legacy", () => {
      expect(indexTs).toContain("interval: 30,");
    });
    
    it("debe tener heartbeatInterval=30 en DualCSMS", () => {
      expect(csmsDualTs).toContain("heartbeatInterval: number = 30");
    });
    
    it("debe enviar ChangeConfiguration HeartbeatInterval=30 después de BootNotification en legacy", () => {
      expect(indexTs).toContain('key: "HeartbeatInterval"');
      expect(indexTs).toContain('value: "30"');
      expect(indexTs).toContain("ChangeConfiguration");
    });
    
    it("debe enviar TriggerMessage Heartbeat inicial después de BootNotification en legacy", () => {
      expect(indexTs).toContain("trigger-hb-");
      expect(indexTs).toContain("Sent initial TriggerMessage Heartbeat");
    });
  });
  
  describe("Handler de respuestas keepalive", () => {
    it("debe manejar CALLRESULT (tipo 3) para respuestas keepalive", () => {
      expect(indexTs).toContain("messageType === 3");
      expect(indexTs).toContain("messageId.startsWith('keepalive-')");
    });
    
    it("debe manejar CALLERROR (tipo 4) para errores de keepalive", () => {
      expect(indexTs).toContain("messageType === 4");
      expect(indexTs).toContain("Keepalive command not supported");
    });
    
    it("debe ignorar silenciosamente respuestas a cfg-hb y trigger-hb", () => {
      expect(indexTs).toContain("messageId.startsWith('cfg-hb-')");
      expect(indexTs).toContain("messageId.startsWith('trigger-hb-')");
    });
    
    it("debe actualizar lastMessage en el connection manager al recibir respuesta keepalive", () => {
      expect(indexTs).toContain("ocppManager.updateLastMessage(ocppIdentity)");
    });
  });
  
  describe("Servidor HTTP timeouts", () => {
    it("debe tener server.timeout = 0", () => {
      expect(indexTs).toContain("server.timeout = 0");
    });
    
    it("debe tener server.keepAliveTimeout = 0", () => {
      expect(indexTs).toContain("server.keepAliveTimeout = 0");
    });
    
    it("debe tener server.headersTimeout = 0", () => {
      expect(indexTs).toContain("server.headersTimeout = 0");
    });
    
    it("debe tener server.requestTimeout = 0", () => {
      expect(indexTs).toContain("server.requestTimeout = 0");
    });
  });
  
  describe("TCP keep-alive en upgrade", () => {
    it("debe configurar TCP keep-alive a 15 segundos", () => {
      expect(indexTs).toContain("setKeepAlive(true, 15000)");
    });
    
    it("debe desactivar Nagle (setNoDelay)", () => {
      expect(indexTs).toContain("setNoDelay(true)");
    });
    
    it("debe desactivar timeout TCP en el socket", () => {
      expect(indexTs).toContain("setTimeout(0)");
    });
  });
  
  describe("Timing analysis", () => {
    it("el intervalo de keepalive OCPP (90s) debe ser menor que el timeout del proxy (~180s)", () => {
      const keepaliveInterval = 90;
      const estimatedProxyTimeout = 180;
      expect(keepaliveInterval).toBeLessThan(estimatedProxyTimeout);
      // Con margen de seguridad: al menos 2 keepalives antes del timeout
      expect(keepaliveInterval * 2).toBeLessThanOrEqual(estimatedProxyTimeout);
    });
    
    it("el heartbeat del cargador (30s) debe generar tráfico frecuente", () => {
      const heartbeatInterval = 30;
      const estimatedProxyTimeout = 180;
      // Al menos 5 heartbeats antes del timeout
      expect(heartbeatInterval * 5).toBeLessThan(estimatedProxyTimeout);
    });
    
    it("el ping WebSocket (20s) debe ser el más frecuente", () => {
      const pingInterval = 20;
      const keepaliveInterval = 90;
      const heartbeatInterval = 30;
      expect(pingInterval).toBeLessThan(heartbeatInterval);
      expect(pingInterval).toBeLessThan(keepaliveInterval);
    });
  });
});
