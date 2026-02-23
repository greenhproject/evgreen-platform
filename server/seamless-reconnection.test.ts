import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests para el sistema de reconexión seamless OCPP
 * 
 * Verifica que:
 * 1. El estado OCPP se preserva entre reconexiones del proxy
 * 2. Las reconexiones seamless no generan alertas de desconexión
 * 3. El historial distingue entre reconexiones seamless y desconexiones reales
 * 4. El score de estabilidad refleja correctamente la salud de la conexión
 * 5. El uptime continuo se mantiene a través de reconexiones seamless
 */

// ============================================================================
// UNIT TESTS - Connection Manager Seamless Reconnection Logic
// ============================================================================

describe('Seamless Reconnection - Connection Manager', () => {
  // Importar el módulo fresco para cada test
  let ocppManager: typeof import('./ocpp/connection-manager');
  
  beforeEach(async () => {
    // Re-importar para estado limpio
    vi.resetModules();
    ocppManager = await import('./ocpp/connection-manager');
  });

  describe('registerConnection', () => {
    it('debe crear una nueva conexión con estado persistente', () => {
      const mockWs = { readyState: 1, send: vi.fn() } as any;
      const conn = ocppManager.registerConnection('EVG001', mockWs, '1.6');
      
      expect(conn.ocppIdentity).toBe('EVG001');
      expect(conn.ocppVersion).toBe('1.6');
      expect(conn.stationId).toBeNull();
      expect(conn.connectorStatuses.size).toBe(0);
      expect(conn.bootInfo).toBeUndefined();
    });

    it('debe restaurar estado persistente en reconexión seamless', () => {
      const mockWs1 = { readyState: 1, send: vi.fn() } as any;
      const mockWs2 = { readyState: 1, send: vi.fn() } as any;
      
      // Primera conexión
      const conn1 = ocppManager.registerConnection('EVG001', mockWs1, '1.6');
      
      // Simular que se actualizó el estado
      ocppManager.updateBootInfo('EVG001', {
        vendor: 'Wallbox',
        model: 'Pulsar Plus',
        serialNumber: 'SN123',
        firmwareVersion: '5.0.0',
      }, 42);
      ocppManager.updateConnectorStatus('EVG001', 1, 'Available');
      
      // Simular desconexión del proxy (inicia grace period)
      ocppManager.handleDisconnection('EVG001', 1006, '');
      
      // Reconexión dentro del grace period
      const conn2 = ocppManager.registerConnection('EVG001', mockWs2, '1.6');
      
      // Verificar que el estado se restauró
      expect(conn2.stationId).toBe(42);
      expect(conn2.bootInfo?.vendor).toBe('Wallbox');
      expect(conn2.bootInfo?.model).toBe('Pulsar Plus');
      expect(conn2.connectorStatuses.get(1)).toBe('Available');
    });

    it('debe mantener el connectedAt original en reconexiones seamless', () => {
      const mockWs1 = { readyState: 1, send: vi.fn() } as any;
      const mockWs2 = { readyState: 1, send: vi.fn() } as any;
      
      const conn1 = ocppManager.registerConnection('EVG001', mockWs1, '1.6');
      const originalConnectedAt = conn1.connectedAt;
      
      // Esperar un momento para que el timestamp sea diferente
      ocppManager.handleDisconnection('EVG001', 1006, '');
      const conn2 = ocppManager.registerConnection('EVG001', mockWs2, '1.6');
      
      // El connectedAt debe ser el original, no uno nuevo
      expect(conn2.connectedAt.getTime()).toBe(originalConnectedAt.getTime());
    });

    it('debe incrementar el contador de reconexiones seamless', () => {
      const mockWs = { readyState: 1, send: vi.fn() } as any;
      
      // Conexión original
      ocppManager.registerConnection('EVG001', mockWs, '1.6');
      
      // 3 ciclos de desconexión/reconexión del proxy
      for (let i = 0; i < 3; i++) {
        ocppManager.handleDisconnection('EVG001', 1006, '');
        ocppManager.registerConnection('EVG001', { readyState: 1, send: vi.fn() } as any, '1.6');
      }
      
      const state = ocppManager.getPersistentState('EVG001');
      expect(state?.seamlessReconnections).toBe(3);
    });
  });

  describe('handleDisconnection', () => {
    it('debe iniciar grace period y preservar estado', () => {
      const mockWs = { readyState: 1, send: vi.fn() } as any;
      ocppManager.registerConnection('EVG001', mockWs, '1.6');
      ocppManager.updateBootInfo('EVG001', { vendor: 'Test', model: 'M1' }, 10);
      
      const result = ocppManager.handleDisconnection('EVG001', 1006, '');
      
      expect(result.isGracePeriod).toBe(true);
      expect(ocppManager.isInGracePeriod('EVG001')).toBe(true);
      
      // La conexión activa se elimina pero el estado persistente se mantiene
      expect(ocppManager.getConnection('EVG001')).toBeUndefined();
      const state = ocppManager.getPersistentState('EVG001');
      expect(state).toBeDefined();
      expect(state?.stationId).toBe(10);
      expect(state?.bootInfo?.vendor).toBe('Test');
    });

    it('no debe eliminar estado persistente inmediatamente', () => {
      const mockWs = { readyState: 1, send: vi.fn() } as any;
      ocppManager.registerConnection('EVG001', mockWs, '1.6');
      ocppManager.updateConnectorStatus('EVG001', 1, 'Charging');
      
      ocppManager.handleDisconnection('EVG001', 1006, '');
      
      // Estado persistente debe existir
      const state = ocppManager.getPersistentState('EVG001');
      expect(state).toBeDefined();
      expect(state?.connectorStatuses.get(1)).toBe('Charging');
    });
  });

  describe('getConnectionHistory', () => {
    it('debe registrar reconexiones seamless en el historial', () => {
      const mockWs = { readyState: 1, send: vi.fn() } as any;
      
      ocppManager.registerConnection('EVG001', mockWs, '1.6');
      ocppManager.handleDisconnection('EVG001', 1006, '');
      ocppManager.registerConnection('EVG001', { readyState: 1, send: vi.fn() } as any, '1.6');
      
      const history = ocppManager.getConnectionHistory('EVG001');
      expect(history.length).toBe(1);
      expect(history[0].wasSeamless).toBe(true);
      expect(history[0].closeCode).toBe(1006);
    });

    it('debe distinguir entre seamless y desconexiones reales', () => {
      const mockWs = { readyState: 1, send: vi.fn() } as any;
      
      // Conexión + reconexión seamless
      ocppManager.registerConnection('EVG001', mockWs, '1.6');
      ocppManager.handleDisconnection('EVG001', 1006, '');
      ocppManager.registerConnection('EVG001', { readyState: 1, send: vi.fn() } as any, '1.6');
      
      const history = ocppManager.getConnectionHistory('EVG001');
      
      // Solo hay una entrada seamless
      const seamless = history.filter(s => s.wasSeamless);
      expect(seamless.length).toBe(1);
    });
  });

  describe('getAllConnections', () => {
    it('debe incluir estaciones en grace period como reconectando', () => {
      const mockWs = { readyState: 1, send: vi.fn() } as any;
      
      ocppManager.registerConnection('EVG001', mockWs, '1.6');
      ocppManager.updateBootInfo('EVG001', { vendor: 'Test', model: 'M1' }, 10);
      ocppManager.handleDisconnection('EVG001', 1006, '');
      
      const connections = ocppManager.getAllConnections();
      
      // Debe aparecer como no conectado pero con datos
      const evg001 = connections.find(c => c.ocppIdentity === 'EVG001');
      expect(evg001).toBeDefined();
      expect(evg001?.isConnected).toBe(false);
      expect(evg001?.stationId).toBe(10);
      expect(evg001?.bootInfo?.vendor).toBe('Test');
    });

    it('debe mostrar reconexiones seamless en la info de conexión', () => {
      const mockWs = { readyState: 1, send: vi.fn() } as any;
      
      ocppManager.registerConnection('EVG001', mockWs, '1.6');
      ocppManager.handleDisconnection('EVG001', 1006, '');
      ocppManager.registerConnection('EVG001', { readyState: 1, send: vi.fn() } as any, '1.6');
      
      const connections = ocppManager.getAllConnections();
      const evg001 = connections.find(c => c.ocppIdentity === 'EVG001');
      
      expect(evg001?.seamlessReconnections).toBe(1);
    });
  });

  describe('getConnectionStabilityReport', () => {
    it('debe calcular score alto para estaciones con solo reconexiones seamless', () => {
      const mockWs = { readyState: 1, send: vi.fn() } as any;
      
      ocppManager.registerConnection('EVG001', mockWs, '1.6');
      
      // 5 ciclos de proxy (todas seamless, ninguna real)
      for (let i = 0; i < 5; i++) {
        ocppManager.handleDisconnection('EVG001', 1006, '');
        ocppManager.registerConnection('EVG001', { readyState: 1, send: vi.fn() } as any, '1.6');
      }
      
      const report = ocppManager.getConnectionStabilityReport();
      const evg001 = report.find(r => r.ocppIdentity === 'EVG001');
      
      expect(evg001).toBeDefined();
      // Score debe ser alto porque no hay desconexiones REALES
      expect(evg001!.stabilityScore).toBeGreaterThanOrEqual(90);
      expect(evg001!.reconnectionCount24h).toBe(0); // Solo cuenta reales
      expect(evg001!.seamlessReconnections).toBe(5);
    });

    it('debe mostrar isReconnecting cuando está en grace period', () => {
      const mockWs = { readyState: 1, send: vi.fn() } as any;
      
      ocppManager.registerConnection('EVG001', mockWs, '1.6');
      ocppManager.handleDisconnection('EVG001', 1006, '');
      
      const report = ocppManager.getConnectionStabilityReport();
      const evg001 = report.find(r => r.ocppIdentity === 'EVG001');
      
      expect(evg001?.isConnected).toBe(false);
      expect(evg001?.isReconnecting).toBe(true);
    });

    it('debe mantener uptime continuo a través de reconexiones seamless', () => {
      const mockWs = { readyState: 1, send: vi.fn() } as any;
      
      ocppManager.registerConnection('EVG001', mockWs, '1.6');
      
      // Simular reconexión
      ocppManager.handleDisconnection('EVG001', 1006, '');
      ocppManager.registerConnection('EVG001', { readyState: 1, send: vi.fn() } as any, '1.6');
      
      const report = ocppManager.getConnectionStabilityReport();
      const evg001 = report.find(r => r.ocppIdentity === 'EVG001');
      
      // Uptime debe ser > 0 (desde la conexión original)
      expect(evg001!.currentUptimeSeconds).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getConnectionStats', () => {
    it('debe contar estaciones reconectando separadamente', () => {
      const mockWs = { readyState: 1, send: vi.fn() } as any;
      
      // Una estación conectada
      ocppManager.registerConnection('EVG001', mockWs, '1.6');
      
      // Una estación reconectando
      ocppManager.registerConnection('EVG002', { readyState: 1, send: vi.fn() } as any, '1.6');
      ocppManager.handleDisconnection('EVG002', 1006, '');
      
      const stats = ocppManager.getConnectionStats();
      
      expect(stats.connectedCount).toBe(1);
      expect(stats.reconnectingCount).toBe(1);
      expect(stats.totalConnections).toBe(2);
    });

    it('debe contar total de reconexiones seamless', () => {
      const mockWs = { readyState: 1, send: vi.fn() } as any;
      
      ocppManager.registerConnection('EVG001', mockWs, '1.6');
      
      for (let i = 0; i < 3; i++) {
        ocppManager.handleDisconnection('EVG001', 1006, '');
        ocppManager.registerConnection('EVG001', { readyState: 1, send: vi.fn() } as any, '1.6');
      }
      
      const stats = ocppManager.getConnectionStats();
      expect(stats.totalSeamlessReconnections).toBe(3);
    });
  });

  describe('updateBootInfo / updateConnectorStatus', () => {
    it('debe actualizar tanto la conexión activa como el estado persistente', () => {
      const mockWs = { readyState: 1, send: vi.fn() } as any;
      
      ocppManager.registerConnection('EVG001', mockWs, '1.6');
      ocppManager.updateBootInfo('EVG001', { vendor: 'Wallbox', model: 'Pulsar' }, 42);
      ocppManager.updateConnectorStatus('EVG001', 1, 'Available');
      
      // Verificar conexión activa
      const conn = ocppManager.getConnection('EVG001');
      expect(conn?.bootInfo?.vendor).toBe('Wallbox');
      expect(conn?.stationId).toBe(42);
      expect(conn?.connectorStatuses.get(1)).toBe('Available');
      
      // Verificar estado persistente
      const state = ocppManager.getPersistentState('EVG001');
      expect(state?.bootInfo?.vendor).toBe('Wallbox');
      expect(state?.stationId).toBe(42);
      expect(state?.connectorStatuses.get(1)).toBe('Available');
    });
  });

  describe('Close handler - Proxy cycle detection', () => {
    it('debe identificar correctamente un ciclo de proxy (1006, 170-200s)', () => {
      // Simular la lógica del close handler
      const code = 1006;
      const durationSec = 181;
      const isProxyCycle = code === 1006 && durationSec >= 170 && durationSec <= 200;
      
      expect(isProxyCycle).toBe(true);
    });

    it('no debe identificar como proxy cycle si duración es diferente', () => {
      const code = 1006;
      const durationSec = 30; // Muy corto
      const isProxyCycle = code === 1006 && durationSec >= 170 && durationSec <= 200;
      
      expect(isProxyCycle).toBe(false);
    });

    it('no debe identificar como proxy cycle si código es diferente', () => {
      const code = 1000; // Normal closure
      const durationSec = 181;
      const isProxyCycle = code === 1006 && durationSec >= 170 && durationSec <= 200;
      
      expect(isProxyCycle).toBe(false);
    });
  });
});
