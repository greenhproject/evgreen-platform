import WebSocket from 'ws';

// Probar el endpoint de producción
const prodUrl = 'wss://www.evgreen.lat/api/ocpp/ws/TEST_PROD_001';
console.log('Connecting to:', prodUrl);

const ws = new WebSocket(prodUrl, ['ocpp1.6']);

ws.on('open', () => {
  console.log('[SUCCESS] Connected! Protocol:', ws.protocol);
  
  const bootNotification = [2, 'msg1', 'BootNotification', {
    chargePointVendor: 'TestVendor',
    chargePointModel: 'TestModel'
  }];
  console.log('[SEND]', JSON.stringify(bootNotification));
  ws.send(JSON.stringify(bootNotification));
});

ws.on('message', (data) => {
  console.log('[RECV]', data.toString());
  
  // Enviar Heartbeat
  setTimeout(() => {
    const heartbeat = [2, 'msg2', 'Heartbeat', {}];
    console.log('[SEND]', JSON.stringify(heartbeat));
    ws.send(JSON.stringify(heartbeat));
  }, 1000);
  
  setTimeout(() => {
    console.log('[CLOSE] Test completed successfully!');
    ws.close();
    process.exit(0);
  }, 3000);
});

ws.on('error', (err) => {
  console.error('[ERROR]', err.message);
});

ws.on('close', (code, reason) => {
  console.log('[CLOSE] Code:', code, 'Reason:', reason.toString());
  process.exit(code === 1005 || code === 1000 ? 0 : 1);
});

setTimeout(() => {
  console.log('[TIMEOUT] No response after 20s');
  process.exit(1);
}, 20000);
