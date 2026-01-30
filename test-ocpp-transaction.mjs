// Script para probar flujo completo de transacción OCPP
// Uso: node test-ocpp-transaction.mjs

import WebSocket from 'ws';

const WS_URL = 'wss://www.evgreen.lat/api/ocpp/ws/TEST_TRANSACTION_001';
const OCPP_PROTOCOL = 'ocpp1.6';

let messageId = 1;
let transactionId = null;

function generateMessageId() {
  return String(messageId++);
}

function sendCall(ws, action, payload) {
  const id = generateMessageId();
  const message = [2, id, action, payload];
  console.log(`\n[SEND] ${action}:`, JSON.stringify(payload));
  ws.send(JSON.stringify(message));
  return id;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTransactionTest() {
  console.log('='.repeat(60));
  console.log('PRUEBA DE TRANSACCIÓN OCPP COMPLETA');
  console.log('='.repeat(60));
  console.log(`\nConectando a: ${WS_URL}`);
  
  const ws = new WebSocket(WS_URL, [OCPP_PROTOCOL]);
  
  ws.on('open', async () => {
    console.log('\n[SUCCESS] Conectado al servidor OCPP');
    
    // 1. BootNotification
    console.log('\n--- PASO 1: BootNotification ---');
    sendCall(ws, 'BootNotification', {
      chargePointVendor: 'TestVendor',
      chargePointModel: 'TestModel-TX',
      chargeBoxSerialNumber: 'TX001',
      firmwareVersion: '1.0.0'
    });
    
    await sleep(2000);
    
    // 2. StatusNotification - Conector disponible
    console.log('\n--- PASO 2: StatusNotification (Available) ---');
    sendCall(ws, 'StatusNotification', {
      connectorId: 1,
      errorCode: 'NoError',
      status: 'Available'
    });
    
    await sleep(1000);
    
    // 3. StartTransaction
    console.log('\n--- PASO 3: StartTransaction ---');
    sendCall(ws, 'StartTransaction', {
      connectorId: 1,
      idTag: 'USER001',
      meterStart: 0,
      timestamp: new Date().toISOString()
    });
    
    await sleep(2000);
    
    // 4. StatusNotification - Cargando
    console.log('\n--- PASO 4: StatusNotification (Charging) ---');
    sendCall(ws, 'StatusNotification', {
      connectorId: 1,
      errorCode: 'NoError',
      status: 'Charging'
    });
    
    await sleep(1000);
    
    // 5. MeterValues - Simular consumo progresivo
    console.log('\n--- PASO 5: MeterValues (simulando carga) ---');
    
    // Simular 3 lecturas de medidor (cada una representa ~5 kWh)
    const meterReadings = [5000, 10000, 15000]; // Wh
    
    for (let i = 0; i < meterReadings.length; i++) {
      await sleep(2000);
      console.log(`\n  Lectura ${i + 1}: ${meterReadings[i]} Wh (${meterReadings[i]/1000} kWh)`);
      sendCall(ws, 'MeterValues', {
        connectorId: 1,
        transactionId: transactionId || 1,
        meterValue: [{
          timestamp: new Date().toISOString(),
          sampledValue: [{
            value: String(meterReadings[i]),
            context: 'Sample.Periodic',
            format: 'Raw',
            measurand: 'Energy.Active.Import.Register',
            unit: 'Wh'
          }]
        }]
      });
    }
    
    await sleep(2000);
    
    // 6. StopTransaction
    console.log('\n--- PASO 6: StopTransaction ---');
    sendCall(ws, 'StopTransaction', {
      transactionId: transactionId || 1,
      idTag: 'USER001',
      meterStop: 15000, // 15 kWh total
      timestamp: new Date().toISOString(),
      reason: 'Local'
    });
    
    await sleep(2000);
    
    // 7. StatusNotification - Disponible de nuevo
    console.log('\n--- PASO 7: StatusNotification (Available) ---');
    sendCall(ws, 'StatusNotification', {
      connectorId: 1,
      errorCode: 'NoError',
      status: 'Available'
    });
    
    await sleep(2000);
    
    console.log('\n' + '='.repeat(60));
    console.log('PRUEBA COMPLETADA');
    console.log('='.repeat(60));
    console.log('\nRevisa los dashboards para ver las métricas actualizadas:');
    console.log('- Admin: /admin/dashboard');
    console.log('- Monitor OCPP: /admin/ocpp-monitor');
    console.log('- Transacciones: /admin/transactions');
    
    ws.close();
  });
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      const [messageType, id, ...rest] = message;
      
      if (messageType === 3) { // CallResult
        const payload = rest[0];
        console.log(`[RECV] Response:`, JSON.stringify(payload));
        
        // Capturar transactionId de StartTransaction
        if (payload.transactionId) {
          transactionId = payload.transactionId;
          console.log(`  -> TransactionId asignado: ${transactionId}`);
        }
      } else if (messageType === 4) { // CallError
        console.log(`[ERROR] ${rest[0]}: ${rest[1]}`);
      }
    } catch (e) {
      console.log('[RECV RAW]', data.toString());
    }
  });
  
  ws.on('error', (error) => {
    console.error('[ERROR]', error.message);
  });
  
  ws.on('close', (code, reason) => {
    console.log(`\n[CLOSED] Código: ${code}, Razón: ${reason || 'N/A'}`);
    process.exit(0);
  });
}

runTransactionTest();
