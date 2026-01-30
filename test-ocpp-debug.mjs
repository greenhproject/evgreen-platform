import WebSocket from 'ws';

// Crear un servidor WebSocket simple para probar
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

const httpServer = createServer();
const wss = new WebSocketServer({ 
  noServer: true,
  handleProtocols: (protocols) => {
    console.log('[SERVER] Requested protocols:', Array.from(protocols));
    if (protocols.has('ocpp1.6')) return 'ocpp1.6';
    return false;
  }
});

httpServer.on('upgrade', (request, socket, head) => {
  console.log('[SERVER] Upgrade request for:', request.url);
  wss.handleUpgrade(request, socket, head, (ws) => {
    console.log('[SERVER] Upgrade complete, emitting connection');
    wss.emit('connection', ws, request);
  });
});

wss.on('connection', (ws, req) => {
  console.log('[SERVER] New connection! Protocol:', ws.protocol);
  
  ws.on('message', (data) => {
    console.log('[SERVER] Received:', data.toString());
    const msg = JSON.parse(data.toString());
    if (msg[0] === 2) {
      const response = [3, msg[1], { currentTime: new Date().toISOString(), interval: 60, status: 'Accepted' }];
      console.log('[SERVER] Sending:', JSON.stringify(response));
      ws.send(JSON.stringify(response));
    }
  });
});

httpServer.listen(3001, () => {
  console.log('[SERVER] Test server running on port 3001');
  
  // Ahora conectar como cliente
  setTimeout(() => {
    const client = new WebSocket('ws://localhost:3001/test/CP001', ['ocpp1.6']);
    
    client.on('open', () => {
      console.log('[CLIENT] Connected! Protocol:', client.protocol);
      const bootNotification = [2, 'msg1', 'BootNotification', { chargePointVendor: 'Test', chargePointModel: 'Test' }];
      console.log('[CLIENT] Sending:', JSON.stringify(bootNotification));
      client.send(JSON.stringify(bootNotification));
    });
    
    client.on('message', (data) => {
      console.log('[CLIENT] Received:', data.toString());
      client.close();
      httpServer.close();
      process.exit(0);
    });
    
    client.on('error', (err) => {
      console.error('[CLIENT] Error:', err.message);
      process.exit(1);
    });
  }, 500);
});

setTimeout(() => {
  console.log('[TIMEOUT]');
  process.exit(1);
}, 10000);
