/**
 * seed-demo-org.mjs - Datos demo para org_id=1 (Gerencia@greenhproject.com)
 */
import mysql from 'mysql2/promise';

const ORG_ID = 1;
const USER_ID = 7440156;

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randFloat = (min, max) => parseFloat((Math.random() * (max - min) + min).toFixed(3));
const daysAgo = (n) => new Date(Date.now() - n * 86400000);
const hoursAgo = (n) => new Date(Date.now() - n * 3600000);

// 1. Actualizar organización
console.log('📦 Actualizando organización...');
await conn.execute(
  `UPDATE organizations SET name='Centro Comercial Andino EV', org_plan='professional', org_status='active' WHERE id=?`,
  [ORG_ID]
);

// 2. Actualizar estación existente
console.log('🔌 Actualizando estación existente...');
await conn.execute(
  `UPDATE charging_stations SET name='CC Andino - Nivel P3', description='Estación principal nivel P3, zona norte',
   address='Carrera 11 # 82-71, Parqueadero P3', city='Bogotá', department='Cundinamarca',
   latitude=4.6673, longitude=-74.0528, isActive=1, isPublic=1, isOnline=1, organization_id=? WHERE id=150001`,
  [ORG_ID]
);

const [existTariff150001] = await conn.execute('SELECT id FROM tariffs WHERE stationId=150001 LIMIT 1');
if (existTariff150001.length === 0) {
  await conn.execute(
    `INSERT INTO tariffs (stationId,name,pricePerKwh,pricePerMinute,pricePerSession,reservationFee,overstayPenaltyPerMinute,overstayGracePeriodMinutes,isActive,autoPricing,priceMinKwh,priceMaxKwh,connectionFee,createdAt,updatedAt)
     VALUES (150001,'Tarifa Estándar',1300,0,2000,5000,500,10,1,0,1100,1800,2000,NOW(),NOW())`
  );
} else {
  await conn.execute(
    `UPDATE tariffs SET pricePerKwh=1300,pricePerSession=2000,reservationFee=5000,autoPricing=0,priceMinKwh=1100,priceMaxKwh=1800,connectionFee=2000 WHERE stationId=150001`
  );
}

// 3. Crear estaciones nuevas
console.log('🏗️ Creando estaciones demo...');
const stations = [
  { id:150002, name:'CC Andino - Nivel P1 VIP', desc:'Zona VIP nivel P1, cargadores rápidos DC', addr:'Carrera 11 # 82-71, P1', city:'Bogotá', lat:4.6675, lng:-74.0530, ocpp:'ANDINO-P1-001', kwh:1500, sess:3000, resv:8000, auto:1 },
  { id:150003, name:'Oficinas Torre 90 - B1', desc:'Estación corporativa empleados y visitantes', addr:'Calle 90 # 11-13, Sótano 1', city:'Bogotá', lat:4.6760, lng:-74.0490, ocpp:'TORRE90-B1-001', kwh:1200, sess:0, resv:3000, auto:0 },
  { id:150004, name:'Hotel Cosmos 100 - Lobby', desc:'Servicio de carga para huéspedes', addr:'Autopista Norte # 100-16', city:'Bogotá', lat:4.6890, lng:-74.0460, ocpp:'COSMOS100-L1-001', kwh:1400, sess:2500, resv:6000, auto:1 },
];

for (const s of stations) {
  const [ex] = await conn.execute('SELECT id FROM charging_stations WHERE id=?', [s.id]);
  if (ex.length === 0) {
    await conn.execute(
      `INSERT INTO charging_stations (id,ownerId,name,description,address,city,department,country,latitude,longitude,ocppIdentity,isOnline,isPublic,isActive,organization_id,investorSharePercent,evgreenSharePercent,energyPurchaseCostPerKwh,createdAt,updatedAt)
       VALUES (?,?,?,?,?,?,'Cundinamarca','Colombia',?,?,?,1,1,1,?,70,30,850,NOW(),NOW())`,
      [s.id, USER_ID, s.name, s.desc, s.addr, s.city, s.lat, s.lng, s.ocpp, ORG_ID]
    );
  }
  const [exT] = await conn.execute('SELECT id FROM tariffs WHERE stationId=?', [s.id]);
  if (exT.length === 0) {
    await conn.execute(
      `INSERT INTO tariffs (stationId,name,pricePerKwh,pricePerMinute,pricePerSession,reservationFee,overstayPenaltyPerMinute,overstayGracePeriodMinutes,isActive,autoPricing,priceMinKwh,priceMaxKwh,connectionFee,createdAt,updatedAt)
       VALUES (?,?,?,0,?,?,500,10,1,?,?,?,2000,NOW(),NOW())`,
      [s.id, 'Tarifa Estándar', s.kwh, s.sess, s.resv, s.auto, Math.round(s.kwh*0.85), Math.round(s.kwh*1.4)]
    );
  }
  const [exE] = await conn.execute('SELECT id FROM evses WHERE stationId=?', [s.id]);
  if (exE.length === 0) {
    const ctype = s.id === 150002 ? 'CCS_2' : 'TYPE_2';
    const chtype = s.id === 150002 ? 'DC' : 'AC';
    const pw = s.id === 150002 ? 60 : 22;
    const amp = s.id === 150002 ? 250 : 32;
    await conn.execute(
      `INSERT INTO evses (stationId,evseIdLocal,connectorId,connector_type,charge_type,powerKw,maxVoltage,maxAmperage,connector_status,isActive,createdAt,updatedAt)
       VALUES (?,1,1,?,?,?,220,?,'Available',1,NOW(),NOW())`,
      [s.id, ctype, chtype, pw, amp]
    );
    if (s.id === 150002) {
      await conn.execute(
        `INSERT INTO evses (stationId,evseIdLocal,connectorId,connector_type,charge_type,powerKw,maxVoltage,maxAmperage,connector_status,isActive,createdAt,updatedAt)
         VALUES (?,2,2,'CHADEMO','DC',50,500,125,'Available',1,NOW(),NOW())`,
        [s.id]
      );
    }
  }
}
console.log('✅ Estaciones creadas');

// 4. Transacciones históricas
console.log('💳 Creando transacciones demo...');
await conn.execute(`DELETE FROM transactions WHERE stationId IN (150001,150002,150003,150004)`);

const [evses] = await conn.execute(
  `SELECT e.id, e.stationId, e.powerKw FROM evses e JOIN charging_stations s ON e.stationId=s.id WHERE s.organization_id=?`,
  [ORG_ID]
);
const [tariffs] = await conn.execute(
  `SELECT t.id, t.stationId, t.pricePerKwh FROM tariffs t JOIN charging_stations s ON t.stationId=s.id WHERE s.organization_id=?`,
  [ORG_ID]
);
const tariffMap = {};
tariffs.forEach(t => { tariffMap[t.stationId] = { id: t.id, pricePerKwh: Number(t.pricePerKwh) }; });

let txCount = 0;
for (let day = 90; day >= 1; day--) {
  const date = daysAgo(day);
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  const txPerDay = isWeekend ? rand(3, 8) : rand(1, 5);
  for (let t = 0; t < txPerDay; t++) {
    const evse = evses[rand(0, evses.length - 1)];
    const tariff = tariffMap[evse.stationId];
    if (!tariff) continue;
    const hour = rand(7, 22);
    const startTime = new Date(date);
    startTime.setHours(hour, rand(0, 59), 0, 0);
    const durationMin = rand(20, 90);
    const endTime = new Date(startTime.getTime() + durationMin * 60000);
    const kwhConsumed = parseFloat((Number(evse.powerKw) * (durationMin / 60) * randFloat(0.6, 0.95)).toFixed(3));
    const priceKwh = tariff.pricePerKwh + rand(-100, 200);
    const energyCost = Math.round(kwhConsumed * priceKwh);
    const sessionCost = energyCost + 2000;
    const totalCost = sessionCost;
    const investorShare = Math.round(totalCost * 0.70);
    const platformFee = Math.round(totalCost * 0.30);
    const meterStart = rand(10000, 50000);
    const meterEnd = meterStart + Math.round(kwhConsumed * 1000);
    const ocppId = `DEMO-${day}-${t}-${Math.random().toString(36).substr(2,4)}`;
    try {
      await conn.execute(
        `INSERT INTO transactions (evseId,userId,stationId,tariffId,ocppTransactionId,ocppNumericTxId,startTime,endTime,kwhConsumed,meterStart,meterEnd,energyCost,timeCost,sessionCost,overstayCost,totalCost,investorShare,platformFee,transaction_status,startMethod,stopReason,reservationId,createdAt,updatedAt,manualSoc,manualBatteryCapacityKwh,chargeMode,targetValue,appliedPricePerKwh)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [evse.id,USER_ID,evse.stationId,tariff.id,ocppId,null,startTime,endTime,kwhConsumed,meterStart,meterEnd,energyCost,0,sessionCost,0,totalCost,investorShare,platformFee,'COMPLETED','APP','EV_DISCONNECTED',null,startTime,endTime,null,null,'FULL',null,priceKwh]
      );
      txCount++;
    } catch(e) { /* skip */ }
  }
}
console.log(`✅ ${txCount} transacciones creadas`);

// 5. Tickets de soporte
console.log('🎫 Creando tickets de soporte...');
await conn.execute('DELETE FROM support_tickets WHERE organization_id=?', [ORG_ID]);

const demoTickets = [
  {
    subject:'Cargador CC Andino P3 no inicia sesión de carga',
    desc:'Desde ayer el cargador del nivel P3 no permite iniciar sesiones. Los usuarios reportan que el QR no funciona y la app muestra "Error de conexión". El cargador aparece como online en el panel pero no responde.',
    cat:'CHARGING_ISSUE', pri:'HIGH', status:'RESOLVED', stId:150001,
    resolution:'Se identificó un problema con el certificado TLS del cargador. Se renovó el certificado y se reinició el servicio OCPP. El cargador está operando normalmente.',
    createdAt:daysAgo(12), resolvedAt:daysAgo(10), rating:5, ratingComment:'Excelente atención, resolvieron el problema en menos de 48 horas.',
    msgs:[
      {role:'user', msg:'Buenos días, el cargador del nivel P3 no está funcionando desde ayer. Varios clientes se han quejado.', h:12*24},
      {role:'agent', msg:'Hola, gracias por reportarlo. Estamos revisando el estado del cargador. ¿Puedes confirmar si el cargador muestra algún LED de error?', h:12*24-2},
      {role:'user', msg:'Sí, el LED está parpadeando en rojo. La pantalla del cargador muestra "Network Error".', h:12*24-3},
      {role:'agent', msg:'Identificamos el problema: el certificado TLS del cargador venció ayer. Estamos procediendo a renovarlo remotamente. Te avisamos cuando esté listo.', h:12*24-4},
      {role:'agent', msg:'✅ El certificado fue renovado exitosamente y el cargador ya está online. Por favor confirma que puedes iniciar una sesión de prueba.', h:10*24},
      {role:'user', msg:'¡Perfecto! Ya funciona. Muchas gracias por la rápida respuesta.', h:10*24-1},
    ],
  },
  {
    subject:'Solicitud de instalación - Torre 90 Sótano 2',
    desc:'Queremos ampliar nuestra red con un cargador adicional en el sótano 2 de Torre 90. Necesitamos información sobre el proceso de instalación, costos y tiempos.',
    cat:'OTHER', pri:'MEDIUM', status:'IN_PROGRESS', stId:150003,
    resolution:null, createdAt:daysAgo(5), resolvedAt:null, rating:null, ratingComment:null,
    msgs:[
      {role:'user', msg:'Hola, queremos expandir nuestra red. ¿Cuál es el proceso para instalar un nuevo cargador en Torre 90 Sótano 2?', h:5*24},
      {role:'agent', msg:'Excelente decisión. Necesitamos: 1) Plano eléctrico del sótano 2, 2) Capacidad del tablero eléctrico, 3) Distancia desde el tablero al punto de carga.', h:5*24-3},
      {role:'user', msg:'Adjunto el plano. La capacidad del tablero es 220V/63A y la distancia es ~15 metros.', h:4*24},
      {role:'agent', msg:'Perfecto, con esa capacidad podemos instalar un cargador AC de 22kW. Estamos preparando la cotización formal. Te la enviamos en 24 horas.', h:4*24-2},
      {role:'agent', msg:'Adjuntamos la cotización. Tiempo estimado de instalación: 3-5 días hábiles una vez aprobada. ¿Tienes alguna pregunta?', h:2*24},
    ],
  },
  {
    subject:'Error en reporte financiero - datos incorrectos',
    desc:'El reporte financiero del mes anterior muestra ingresos de $0 pero sí hubo transacciones. Necesito el reporte correcto para la junta directiva.',
    cat:'APP_BUG', pri:'HIGH', status:'RESOLVED', stId:null,
    resolution:'Se identificó un problema en el filtro de fechas del reporte. El bug fue corregido. Los datos históricos están correctos en la base de datos.',
    createdAt:daysAgo(20), resolvedAt:daysAgo(18), rating:4, ratingComment:'Buen soporte, aunque hubiera preferido que el bug no existiera.',
    msgs:[
      {role:'user', msg:'El reporte muestra $0 en ingresos pero tuvimos más de 80 sesiones de carga. Necesito esto corregido urgente para una presentación.', h:20*24},
      {role:'agent', msg:'Entendemos la urgencia. Estamos investigando el problema. ¿Puedes indicarme el rango de fechas exacto que seleccionaste?', h:20*24-1},
      {role:'user', msg:'Seleccioné el último mes completo.', h:20*24-1.5},
      {role:'agent', msg:'Encontramos el bug: el filtro excluía el último día del mes. Lo estamos corrigiendo ahora. En 2 horas tendrás el reporte correcto.', h:20*24-3},
      {role:'agent', msg:'✅ Bug corregido. Puedes generar el reporte nuevamente y verás los datos correctos. Disculpa el inconveniente.', h:18*24},
      {role:'user', msg:'Perfecto, ya aparecen los datos correctos. Gracias por la rapidez.', h:18*24-1},
    ],
  },
  {
    subject:'Configurar precios dinámicos IA para temporada alta',
    desc:'Con la temporada navideña queremos activar los precios dinámicos IA para maximizar ingresos. ¿Cómo configuramos los rangos de precio?',
    cat:'OTHER', pri:'LOW', status:'RESOLVED', stId:150001,
    resolution:'Se configuró el precio dinámico IA con rango $1.200-$2.000/kWh. La IA ajustará automáticamente según ocupación y horario pico.',
    createdAt:daysAgo(30), resolvedAt:daysAgo(28), rating:5, ratingComment:'Muy buena asesoría, el equipo conoce muy bien el producto.',
    msgs:[
      {role:'user', msg:'Queremos prepararnos para diciembre. ¿Qué rango de precios recomienda EVGreen para un CC con alto tráfico en temporada navideña?', h:30*24},
      {role:'agent', msg:'Para centros comerciales en temporada alta recomendamos: Precio base: $1.300/kWh, Rango IA: $1.200-$2.000/kWh. La IA sube el precio en horarios pico (12pm-3pm y 6pm-9pm). ¿Quieres que lo configuremos?', h:30*24-4},
      {role:'user', msg:'Sí, por favor configúrenlo para todas las estaciones del CC Andino.', h:29*24},
      {role:'agent', msg:'✅ Configurado. Activamos precio dinámico IA en CC Andino P3 y P1 VIP con rango $1.200-$2.000. Puedes ver los parámetros desde Estaciones → Config → pestaña IA.', h:28*24},
    ],
  },
  {
    subject:'Consulta sobre plan Enterprise y API de integración',
    desc:'Estamos evaluando actualizar al plan Enterprise para integrar EVGreen con nuestro sistema de parqueadero (ParkPlus). ¿Tienen API REST disponible?',
    cat:'OTHER', pri:'MEDIUM', status:'OPEN', stId:null,
    resolution:null, createdAt:daysAgo(2), resolvedAt:null, rating:null, ratingComment:null,
    msgs:[
      {role:'user', msg:'Hola, somos clientes del plan Professional y queremos integrar EVGreen con nuestro sistema de parqueadero ParkPlus. ¿Tienen API disponible?', h:2*24},
      {role:'agent', msg:'Sí, tenemos API REST completa disponible en el plan Enterprise. Incluye: webhooks de eventos de carga, consulta de disponibilidad en tiempo real, inicio/fin de sesiones remotas y reportes programados. ¿Quieres que agendemos una llamada técnica?', h:2*24-3},
      {role:'user', msg:'Sí, nos interesa. ¿Cuánto cuesta el plan Enterprise y qué incluye adicional al Professional?', h:1*24},
    ],
  },
];

for (const tk of demoTickets) {
  const [res] = await conn.execute(
    `INSERT INTO support_tickets (userId,stationId,subject,description,category,priority,status,resolution,resolvedAt,organization_id,rating,ratingComment,ratedAt,createdAt,updatedAt)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [USER_ID, tk.stId, tk.subject, tk.desc, tk.cat, tk.pri, tk.status, tk.resolution, tk.resolvedAt, ORG_ID, tk.rating, tk.ratingComment, tk.rating ? tk.resolvedAt : null, tk.createdAt, tk.resolvedAt || tk.createdAt]
  );
  const ticketId = res.insertId;
  for (const m of tk.msgs) {
    const msgTime = hoursAgo(m.h);
    await conn.execute(
      `INSERT INTO support_messages (ticketId,senderId,senderRole,message,createdAt)
       VALUES (?,?,?,?,?)`,
      [ticketId, USER_ID, m.role === 'user' ? 'user' : 'agent', m.msg, msgTime]
    );
  }
}
console.log('✅ Tickets de soporte creados');

// Resumen
const [stCount] = await conn.execute('SELECT COUNT(*) as cnt FROM charging_stations WHERE organization_id=?', [ORG_ID]);
const [txC] = await conn.execute('SELECT COUNT(*) as cnt FROM transactions WHERE stationId IN (150001,150002,150003,150004)');
const [tkC] = await conn.execute('SELECT COUNT(*) as cnt FROM support_tickets WHERE organization_id=?', [ORG_ID]);
console.log(`\n🎉 DATOS DEMO LISTOS:`);
console.log(`   📍 Estaciones: ${stCount[0].cnt}`);
console.log(`   💳 Transacciones: ${txC[0].cnt}`);
console.log(`   🎫 Tickets: ${tkC[0].cnt}`);
await conn.end();
