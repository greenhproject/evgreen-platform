/**
 * Script para insertar datos de prueba:
 * - Estación de carga en Mosquera (oficina Green House Project)
 * - Usuarios de prueba con diferentes roles
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { nanoid } from 'nanoid';

dotenv.config();

async function seedTestData() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  console.log('🔌 Conectado a la base de datos');
  
  try {
    // ============================================
    // 1. CREAR USUARIOS DE PRUEBA
    // ============================================
    console.log('\n👥 Creando usuarios de prueba...');
    
    const users = [
      {
        openId: nanoid(),
        email: 'info@greenhproject.com',
        name: 'Cliente Green EV',
        role: 'user',
        phone: '+57 300 123 4567'
      },
      {
        openId: nanoid(),
        email: 'admin@greenhproject.com',
        name: 'Inversionista Green EV',
        role: 'investor',
        phone: '+57 300 234 5678',
        companyName: 'Green House Project SAS',
        taxId: '901234567-8'
      },
      {
        openId: nanoid(),
        email: 'soporte@greenhproject.com',
        name: 'Técnico Soporte Green EV',
        role: 'technician',
        phone: '+57 300 345 6789',
        technicianLicense: 'TEC-2025-001',
        assignedRegion: 'Cundinamarca'
      }
    ];
    
    for (const user of users) {
      // Verificar si el usuario ya existe
      const [existing] = await conn.execute(
        'SELECT id FROM users WHERE email = ?',
        [user.email]
      );
      
      if (existing.length > 0) {
        console.log(`  ⚠️  Usuario ${user.email} ya existe, actualizando rol...`);
        await conn.execute(
          'UPDATE users SET role = ?, name = ?, phone = ?, companyName = ?, taxId = ?, technicianLicense = ?, assignedRegion = ? WHERE email = ?',
          [user.role, user.name, user.phone || null, user.companyName || null, user.taxId || null, user.technicianLicense || null, user.assignedRegion || null, user.email]
        );
      } else {
        await conn.execute(
          `INSERT INTO users (openId, email, name, role, phone, companyName, taxId, technicianLicense, assignedRegion) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [user.openId, user.email, user.name, user.role, user.phone || null, user.companyName || null, user.taxId || null, user.technicianLicense || null, user.assignedRegion || null]
        );
        console.log(`  ✅ Usuario creado: ${user.email} (${user.role})`);
      }
    }
    
    // Obtener el ID del inversionista para asignarle la estación
    const [investorRows] = await conn.execute(
      'SELECT id FROM users WHERE email = ?',
      ['admin@greenhproject.com']
    );
    const investorId = investorRows[0]?.id;
    
    // ============================================
    // 2. CREAR ESTACIÓN DE CARGA EN MOSQUERA
    // ============================================
    console.log('\n🔋 Creando estación de carga en Mosquera...');
    
    // Coordenadas de Cra 1 Este No 2-26, Mosquera, Cundinamarca
    // Aproximadas basadas en la ubicación del centro de Mosquera
    const stationData = {
      ocppIdentity: 'GEV-MOSQUERA-001',
      name: 'Green EV Mosquera - Sede Principal',
      description: 'Estación de carga principal de Green House Project ubicada en Mosquera, Cundinamarca. Cuenta con cargadores rápidos DC y AC.',
      address: 'Cra 1 Este No 2-26',
      city: 'Mosquera',
      department: 'Cundinamarca',
      country: 'Colombia',
      postalCode: '250040',
      latitude: 4.7077,  // Coordenadas aproximadas de Mosquera centro
      longitude: -74.2311,
      ownerId: investorId,
      isOnline: true,
      isPublic: true,
      isActive: true,
      operatingHours: JSON.stringify({
        monday: { open: '06:00', close: '22:00' },
        tuesday: { open: '06:00', close: '22:00' },
        wednesday: { open: '06:00', close: '22:00' },
        thursday: { open: '06:00', close: '22:00' },
        friday: { open: '06:00', close: '22:00' },
        saturday: { open: '07:00', close: '21:00' },
        sunday: { open: '08:00', close: '20:00' }
      }),
      amenities: JSON.stringify(['wifi', 'restroom', 'coffee', 'parking', 'security']),
      images: JSON.stringify([
        'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?w=800',
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800'
      ]),
      manufacturer: 'ABB',
      model: 'Terra 184',
      serialNumber: 'ABB-2025-001',
      firmwareVersion: '2.1.0'
    };
    
    // Verificar si la estación ya existe
    const [existingStation] = await conn.execute(
      'SELECT id FROM charging_stations WHERE ocppIdentity = ?',
      [stationData.ocppIdentity]
    );
    
    let stationId;
    if (existingStation.length > 0) {
      stationId = existingStation[0].id;
      console.log(`  ⚠️  Estación ${stationData.ocppIdentity} ya existe, actualizando...`);
      await conn.execute(
        `UPDATE charging_stations SET 
         name = ?, description = ?, address = ?, city = ?, department = ?, country = ?, postalCode = ?,
         latitude = ?, longitude = ?, ownerId = ?, isOnline = ?, isPublic = ?, isActive = ?,
         operatingHours = ?, amenities = ?, images = ?, manufacturer = ?, model = ?,
         serialNumber = ?, firmwareVersion = ?
         WHERE ocppIdentity = ?`,
        [
          stationData.name, stationData.description, stationData.address, stationData.city,
          stationData.department, stationData.country, stationData.postalCode, stationData.latitude,
          stationData.longitude, stationData.ownerId, stationData.isOnline, stationData.isPublic,
          stationData.isActive, stationData.operatingHours, stationData.amenities, stationData.images,
          stationData.manufacturer, stationData.model, stationData.serialNumber, stationData.firmwareVersion,
          stationData.ocppIdentity
        ]
      );
    } else {
      const [result] = await conn.execute(
        `INSERT INTO charging_stations 
         (ocppIdentity, name, description, address, city, department, country, postalCode, 
          latitude, longitude, ownerId, isOnline, isPublic, isActive, operatingHours, 
          amenities, images, manufacturer, model, serialNumber, firmwareVersion)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          stationData.ocppIdentity, stationData.name, stationData.description, stationData.address,
          stationData.city, stationData.department, stationData.country, stationData.postalCode,
          stationData.latitude, stationData.longitude, stationData.ownerId, stationData.isOnline,
          stationData.isPublic, stationData.isActive, stationData.operatingHours, stationData.amenities,
          stationData.images, stationData.manufacturer, stationData.model, stationData.serialNumber,
          stationData.firmwareVersion
        ]
      );
      stationId = result.insertId;
      console.log(`  ✅ Estación creada: ${stationData.name}`);
    }
    
    // ============================================
    // 3. CREAR EVSEs (CONECTORES) PARA LA ESTACIÓN
    // ============================================
    console.log('\n🔌 Creando conectores (EVSEs)...');
    
    const evses = [
      {
        evseIdLocal: 1,
        connectorId: 1,
        connector_type: 'CCS_2',
        charge_type: 'DC',
        powerKw: 150,
        maxVoltage: 920,
        maxAmperage: 200,
        connector_status: 'AVAILABLE'
      },
      {
        evseIdLocal: 2,
        connectorId: 1,
        connector_type: 'CCS_2',
        charge_type: 'DC',
        powerKw: 150,
        maxVoltage: 920,
        maxAmperage: 200,
        connector_status: 'AVAILABLE'
      },
      {
        evseIdLocal: 3,
        connectorId: 1,
        connector_type: 'TYPE_2',
        charge_type: 'AC',
        powerKw: 22,
        maxVoltage: 400,
        maxAmperage: 32,
        connector_status: 'AVAILABLE'
      },
      {
        evseIdLocal: 4,
        connectorId: 1,
        connector_type: 'TYPE_2',
        charge_type: 'AC',
        powerKw: 22,
        maxVoltage: 400,
        maxAmperage: 32,
        connector_status: 'CHARGING' // Simulando uno en uso
      }
    ];
    
    for (const evse of evses) {
      const [existingEvse] = await conn.execute(
        'SELECT id FROM evses WHERE stationId = ? AND evseIdLocal = ?',
        [stationId, evse.evseIdLocal]
      );
      
      if (existingEvse.length > 0) {
        console.log(`  ⚠️  EVSE ${evse.evseIdLocal} ya existe, actualizando...`);
        await conn.execute(
          `UPDATE evses SET connector_type = ?, charge_type = ?, powerKw = ?, 
           maxVoltage = ?, maxAmperage = ?, connector_status = ?
           WHERE stationId = ? AND evseIdLocal = ?`,
          [evse.connector_type, evse.charge_type, evse.powerKw, evse.maxVoltage,
           evse.maxAmperage, evse.connector_status, stationId, evse.evseIdLocal]
        );
      } else {
        await conn.execute(
          `INSERT INTO evses (stationId, evseIdLocal, connectorId, connector_type, charge_type, 
           powerKw, maxVoltage, maxAmperage, connector_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [stationId, evse.evseIdLocal, evse.connectorId, evse.connector_type, evse.charge_type,
           evse.powerKw, evse.maxVoltage, evse.maxAmperage, evse.connector_status]
        );
        console.log(`  ✅ EVSE creado: EVSE-${evse.evseIdLocal} (${evse.connector_type} - ${evse.powerKw}kW)`);
      }
    }
    
    // ============================================
    // 4. CREAR TARIFA POR DEFECTO PARA LA ESTACIÓN
    // ============================================
    console.log('\n💰 Creando tarifas...');
    
    const [existingTariff] = await conn.execute(
      'SELECT id FROM tariffs WHERE stationId = ? AND name = ?',
      [stationId, 'Tarifa Estándar']
    );
    
    if (existingTariff.length === 0) {
      await conn.execute(
        `INSERT INTO tariffs (stationId, name, description, pricePerKwh, pricePerMinute, 
         pricePerSession, reservationFee, noShowPenalty, overstayPenaltyPerMinute, 
         overstayGracePeriodMinutes, isActive, validFrom)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          stationId,
          'Tarifa Estándar',
          'Tarifa estándar para carga de vehículos eléctricos en Colombia',
          1200, // COP por kWh
          50,   // COP por minuto de ocupación
          0,    // Sin cargo por sesión
          5000, // COP por reserva
          10000, // Penalidad por no presentarse
          100,  // COP por minuto de ocupación después de carga
          10,   // 10 minutos de gracia
          true
        ]
      );
      console.log('  ✅ Tarifa estándar creada para la estación');
    } else {
      console.log('  ⚠️  Tarifa estándar ya existe');
    }
    
    // ============================================
    // 5. CREAR BILLETERAS PARA LOS USUARIOS
    // ============================================
    console.log('\n💳 Creando billeteras para usuarios...');
    
    const [allUsers] = await conn.execute('SELECT id, email FROM users');
    
    for (const user of allUsers) {
      const [existingWallet] = await conn.execute(
        'SELECT id FROM wallets WHERE userId = ?',
        [user.id]
      );
      
      if (existingWallet.length === 0) {
        await conn.execute(
          'INSERT INTO wallets (userId, balance, currency) VALUES (?, ?, ?)',
          [user.id, '50000', 'COP'] // Saldo inicial de prueba
        );
        console.log(`  ✅ Billetera creada para ${user.email} con $50,000 COP`);
      }
    }
    
    console.log('\n✨ Datos de prueba insertados exitosamente!\n');
    
    // Resumen
    console.log('📊 RESUMEN:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👥 Usuarios:');
    console.log('   • info@greenhproject.com → Cliente (user)');
    console.log('   • admin@greenhproject.com → Inversionista (investor)');
    console.log('   • soporte@greenhproject.com → Técnico (technician)');
    console.log('');
    console.log('🔋 Estación de carga:');
    console.log('   • Green EV Mosquera - Sede Principal');
    console.log('   • Cra 1 Este No 2-26, Mosquera, Cundinamarca');
    console.log('   • 4 conectores: 2x CCS2 (150kW DC) + 2x Type2 (22kW AC)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await conn.end();
    console.log('\n🔌 Conexión cerrada');
  }
}

seedTestData().catch(console.error);
