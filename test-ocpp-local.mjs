import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:3000/api/ocpp/ws/TEST003', ['ocpp1.6']);

ws.on('open', () => {
  console.log('[OPEN] Connected! Protocol:', ws.protocol);
  
  const bootNotification = [2, 'msg1', 'BootNotification', {
    chargePointVendor: 'TestVendor',
    chargePointModel: 'TestModel'
  }];
  console.log('[SEND]', JSON.stringify(bootNotification));
  ws.send(JSON.stringify(bootNotification));
});

ws.on('message', (data) => {
  console.log('[RECV]', data.toString());
  
  setTimeout(() => {
    const heartbeat = [2, 'msg2', 'Heartbeat', {}];
    console.log('[SEND]', JSON.stringify(heartbeat));
    ws.send(JSON.stringify(heartbeat));
  }, 1000);
  
  setTimeout(() => {
    console.log('[CLOSE] Closing connection');
    ws.close();
  }, 3000);
});

ws.on('error', (err) => {
  console.error('[ERROR]', err.message);
});

ws.on('close', (code, reason) => {
  console.log('[CLOSE] Code:', code, 'Reason:', reason.toString());
  process.exit(0);
});

setTimeout(() => {
  console.log('[TIMEOUT] No response after 15s');
  process.exit(1);
}, 15000);
