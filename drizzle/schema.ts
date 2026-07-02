/**
 * EVGreen Platform - Esquema de Base de Datos (schema.ts)
 * Define TODAS las tablas usando Drizzle ORM. Para aplicar cambios: pnpm db:push
 * @author Green House Project | @version 2.0.0 (Marzo 2026)
 */
import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  boolean,
  json,
  bigint,
  tinyint,
  float,
} from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

// ============================================================================
// ENUMS
// ============================================================================

export const userRoleEnum = mysqlEnum("role", ["staff", "technician", "investor", "user", "admin", "engineer", "host", "comercial"]);
export const connectorStatusEnum = mysqlEnum("connector_status", [
  "AVAILABLE",
  "PREPARING",
  "CHARGING",
  "SUSPENDED_EVSE",
  "SUSPENDED_EV",
  "FINISHING",
  "RESERVED",
  "UNAVAILABLE",
  "FAULTED",
]);
export const connectorTypeEnum = mysqlEnum("connector_type", ["TYPE_1", "TYPE_2", "CCS_1", "CCS_2", "CHADEMO", "TESLA", "GBT_AC", "GBT_DC"]);
export const chargeTypeEnum = mysqlEnum("charge_type", ["AC", "DC"]);
export const transactionStatusEnum = mysqlEnum("transaction_status", [
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
]);
export const reservationStatusEnum = mysqlEnum("reservation_status", [
  "ACTIVE",
  "EXPIRED",
  "CANCELLED",
  "FULFILLED",
  "NO_SHOW",
]);
export const subscriptionTierEnum = mysqlEnum("subscription_tier", ["FREE", "BASIC", "PREMIUM", "ENTERPRISE"]);
export const paymentStatusEnum = mysqlEnum("payment_status", ["PENDING", "COMPLETED", "FAILED", "REFUNDED"]);
export const payoutStatusEnum = mysqlEnum("payout_status", ["PENDING", "REQUESTED", "APPROVED", "PROCESSING", "PAID", "REJECTED"]);
export const maintenanceStatusEnum = mysqlEnum("maintenance_status", ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"]);

// Enums para sistema de postulación de espacios
export const spaceSubmissionStatusEnum = mysqlEnum("space_status", [
  "pending",         // Recién enviado, pendiente de revisión
  "under_review",    // En evaluación técnica por el equipo
  "approved",        // Aprobado técnicamente, listo para carta de intención
  "rejected",        // Rechazado (no viable)
  "letter_sent",     // Carta de intención enviada al postulante
  "letter_accepted", // Carta firmada/aceptada digitalmente
  "published",       // Publicado en el muro de crowdfunding
  "funded",          // Completamente fondeado
  "in_construction", // En construcción/instalación
  "operational",     // Punto operativo
]);

export const spaceTypeEnum = mysqlEnum("space_type", [
  "parking",           // Parqueadero público
  "mall",              // Centro comercial
  "gas_station",       // Estación de servicio
  "hotel",             // Hotel / hospedaje
  "restaurant",        // Restaurante
  "office_building",   // Edificio de oficinas
  "residential",       // Conjunto residencial
  "supermarket",       // Supermercado
  "hospital",          // Hospital / clínica
  "university",        // Universidad / institución educativa
  "airport",           // Aeropuerto
  "highway_rest",      // Parador en carretera
  "other",             // Otro
]);

// ============================================================================
// USERS TABLE
// ============================================================================

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
  phone: varchar("phone", { length: 20 }),
  birthDate: varchar("birthDate", { length: 10 }), // YYYY-MM-DD
  address: varchar("address", { length: 500 }),
  city: varchar("city", { length: 100 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: userRoleEnum.default("user").notNull(),
  avatarUrl: text("avatarUrl"),
  isActive: boolean("isActive").default(true).notNull(),
  // idTag único para identificación OCPP (formato: EV-XXXXXX)
  idTag: varchar("idTag", { length: 20 }).unique(),
  // Para inversionistas - información adicional
  companyName: varchar("companyName", { length: 255 }),
  taxId: varchar("taxId", { length: 50 }), // NIT en Colombia
  // Documento de identidad del usuario (para facturación electrónica)
  documentType: mysqlEnum("document_type", ["CC", "NIT", "CE", "PASAPORTE", "TI", "PEP"]),
  documentNumber: varchar("documentNumber", { length: 50 }),
  // Campos fiscales para facturación electrónica
  fiscalAddress: varchar("fiscalAddress", { length: 500 }),
  fiscalCity: varchar("fiscalCity", { length: 100 }),
  fiscalDepartment: varchar("fiscalDepartment", { length: 100 }),
  kindOfPerson: mysqlEnum("kind_of_person", ["PERSON_ENTITY", "LEGAL_ENTITY"]),
  regime: mysqlEnum("regime", ["SIMPLIFIED_REGIME", "COMMON_REGIME", "NOT_RESPONSIBLE_FOR_IVA"]),
  alegraContactId: varchar("alegraContactId", { length: 50 }), // ID del contacto en Alegra
  bankAccount: varchar("bankAccount", { length: 100 }),
  bankName: varchar("bankName", { length: 100 }),
  // Tipo de inversionista y perfil público (JSON array para tipos NO excluyentes)
  // Permite múltiples tipos simultáneos: ["individual", "collective", "founder"]
  investorTypes: json("investorTypes").$type<string[]>().default([]),
  // Campo legacy para compatibilidad (se mantiene pero se prefiere investorTypes)
  investorType: mysqlEnum("investor_type", ["individual", "collective", "founder"]),
  isFounder: boolean("isFounder").default(false),
  founderTitle: varchar("founderTitle", { length: 100 }), // Ej: "Fundador Visionario", "Co-Fundador"
  founderOrder: int("founderOrder"), // Orden de aparición en el muro
  investorPhotoUrl: text("investorPhotoUrl"), // Foto de perfil del inversionista
  investorQuote: varchar("investorQuote", { length: 500 }), // Frase personalizable
  investorBio: text("investorBio"), // Biografía corta
  investorBadge: varchar("investorBadge", { length: 50 }), // Tipo de insignia: gold, platinum, diamond
  investorJoinedAt: timestamp("investorJoinedAt"), // Fecha de ingreso como inversionista
  investorTotalInvested: bigint("investorTotalInvested", { mode: "number" }).default(0), // Total invertido en COP
  investorShowInWall: boolean("investorShowInWall").default(true), // Visible en muro de fundadores
  // Para técnicos - información adicional
  technicianLicense: varchar("technicianLicense", { length: 100 }),
  assignedRegion: varchar("assignedRegion", { length: 100 }),
  // Token FCM para notificaciones push
  fcmToken: text("fcmToken"),
  fcmTokenUpdatedAt: timestamp("fcmTokenUpdatedAt"),
  // Web Push subscription (JSON string with endpoint, keys)
  pushSubscription: text("pushSubscription"),
  // Preferencias de notificaciones
  notifyChargingComplete: boolean("notifyChargingComplete").default(true),
  notifyLowBalance: boolean("notifyLowBalance").default(true),
  notifyPromotions: boolean("notifyPromotions").default(true),
  // Preferencias de configuración del técnico
  techNotifyNewTickets: boolean("techNotifyNewTickets").default(true),
  techNotifyCriticalAlerts: boolean("techNotifyCriticalAlerts").default(true),
  techNotifyMaintenanceReminders: boolean("techNotifyMaintenanceReminders").default(true),
  techNotifyByEmail: boolean("techNotifyByEmail").default(true),
  techNotifyByPush: boolean("techNotifyByPush").default(true),
  techDefaultView: varchar("techDefaultView", { length: 20 }).default("dashboard"),
  techAutoRefreshLogs: boolean("techAutoRefreshLogs").default(true),
  techRefreshInterval: int("techRefreshInterval").default(30),
  techAvailableForEmergencies: boolean("techAvailableForEmergencies").default(true),
  techWorkingHoursStart: varchar("techWorkingHoursStart", { length: 5 }).default("08:00"),
  techWorkingHoursEnd: varchar("techWorkingHoursEnd", { length: 5 }).default("18:00"),
  // Preferencias de configuración del usuario
  prefLanguage: varchar("prefLanguage", { length: 10 }).default("es"),
  prefDistanceUnit: varchar("prefDistanceUnit", { length: 5 }).default("km"),
  prefCurrency: varchar("prefCurrency", { length: 5 }).default("COP"),
  prefAutoLocate: boolean("prefAutoLocate").default(true),
  prefSaveHistory: boolean("prefSaveHistory").default(true),
  prefShareUsageData: boolean("prefShareUsageData").default(false),
  // Seguridad - 2FA
  twoFactorEnabled: boolean("twoFactorEnabled").default(false),
  twoFactorSecret: varchar("twoFactorSecret", { length: 255 }), // TOTP secret (encrypted)
  twoFactorVerifiedAt: timestamp("twoFactorVerifiedAt"),
  // Onboarding de inversionista
  onboardingCompleted: boolean("onboardingCompleted").default(false),
  onboardingStep: int("onboardingStep").default(0), // 0=no iniciado, 1-6=paso actual
  onboardingStartedAt: timestamp("onboardingStartedAt"),
  onboardingCompletedAt: timestamp("onboardingCompletedAt"),
  welcomeEmailSent: boolean("welcomeEmailSent").default(false),
  // Preferencias de alertas de proximidad
  notifyProximity: boolean("notifyProximity").default(true),
  proximityRadiusKm: int("proximityRadiusKm").default(5), // Radio de búsqueda en km (1-10)
  lastProximityAlertAt: timestamp("lastProximityAlertAt"), // Cooldown de alertas
  lastProximityStationId: int("lastProximityStationId"), // Última estación notificada
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ============================================================================
// CHARGING STATIONS TABLE
// ============================================================================

export const chargingStations = mysqlTable("charging_stations", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(), // FK a users (inversionista)
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  address: varchar("address", { length: 500 }).notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  department: varchar("department", { length: 100 }), // Departamento en Colombia
  country: varchar("country", { length: 100 }).default("Colombia").notNull(),
  timezone: varchar("timezone", { length: 100 }).default("America/Bogota").notNull(), // IANA tz: America/Bogota, America/Mexico_City, etc.
  postalCode: varchar("postalCode", { length: 20 }),
  latitude: decimal("latitude", { precision: 10, scale: 8 }).notNull(),
  longitude: decimal("longitude", { precision: 11, scale: 8 }).notNull(),
  // Identificador OCPP
  ocppIdentity: varchar("ocppIdentity", { length: 100 }).unique(),
  ocppPassword: varchar("ocppPassword", { length: 255 }),
  // Estado y configuración
  isOnline: boolean("isOnline").default(false).notNull(),
  isPublic: boolean("isPublic").default(true).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  // Horarios de operación (JSON: { monday: { open: "06:00", close: "22:00" }, ... })
  operatingHours: json("operatingHours"),
  // Información adicional
  amenities: json("amenities"), // ["wifi", "restroom", "cafe", "parking"]
  images: json("images"), // URLs de imágenes
  imageUrl: text("imageUrl"), // URL de la foto principal de la estación
  thumbnailUrl: text("thumbnailUrl"), // URL de la miniatura optimizada
  contactPhone: varchar("contactPhone", { length: 20 }),
  // Datos de registro UPME/CárgaME
  upmeRegistrationId: varchar("upmeRegistrationId", { length: 100 }),
  cargameId: varchar("cargameId", { length: 100 }),
  // Firmware y modelo
  chargerBrandId: int("chargerBrandId"), // FK a charger_brands (perfil de marca/modelo)
  manufacturer: varchar("manufacturer", { length: 100 }),
  model: varchar("model", { length: 100 }),
  serialNumber: varchar("serialNumber", { length: 100 }),
  firmwareVersion: varchar("firmwareVersion", { length: 50 }),
  lastBootNotification: timestamp("lastBootNotification"),
  // Zona premium para fee adicional (A: $5M, B: $3M, C: $0 estándar)
  premiumZone: mysqlEnum("premiumZone", ["A", "B", "C"]).default("C").notNull(),
  premiumZoneFee: decimal("premiumZoneFee", { precision: 15, scale: 2 }).default("0"),
  // ============================================================================
  // MODELO FINANCIERO CONFIGURABLE POR ESTACIÓN
  // Porcentajes de distribución de ingresos (deben sumar 100%)
  // ============================================================================
  evgreenSharePercent: decimal("evgreenSharePercent", { precision: 5, scale: 2 }).default("30.00").notNull(), // % para EVGreen/GHP (gestor)
  investorSharePercent: decimal("investorSharePercent", { precision: 5, scale: 2 }).default("70.00").notNull(), // % para el inversionista dueño
  hostSharePercent: decimal("hostSharePercent", { precision: 5, scale: 2 }).default("0.00").notNull(), // % para el Aliado Comercial (dueño del espacio)
  // Fondo de mantenimiento (% del share de EVGreen) - solo para estaciones colectivas
  maintenanceFundPercent: decimal("maintenanceFundPercent", { precision: 5, scale: 2 }).default("5.00").notNull(), // % del 30% de EVGreen reservado para mantenimiento
  // Umbral de alerta del fondo de mantenimiento (en COP) - cuando el balance baje de este monto, se envía alerta
  maintenanceFundAlertThreshold: decimal("maintenanceFundAlertThreshold", { precision: 15, scale: 2 }).default("500000.00"), // $500.000 COP por defecto
  // Costo de compra de energía (COP/kWh) - para calcular costo de factura eléctrica
  energyPurchaseCostPerKwh: decimal("energyPurchaseCostPerKwh", { precision: 10, scale: 2 }).default("850.00").notNull(), // Costo promedio de compra de energía de red
  // Aliado Comercial (dueño del espacio donde se instala la estación)
  hostUserId: int("hostUserId"), // FK a users (rol: host). null = el inversionista es también dueño del espacio
  hostName: varchar("hostName", { length: 255 }), // Nombre del aliado comercial (para display)
  // ============================================================================
  // MODELO DE LIQUIDACIÓN DE OCUPACIÓN PARA ALIADOS (PARQUEADEROS)
  // Cuando un EV ocupa el slot post-carga, EVGreen cobra al usuario occupancyRatePerMinute
  // y transfiere al aliado parkingRatePerMinute. EVGreen retiene el diferencial.
  // ============================================================================
  parkingRatePerMinute: int("parkingRatePerMinute").default(0).notNull(), // COP/min que el aliado cobra en su parqueadero (lo que EVGreen le transfiere)
  occupancyRatePerMinute: int("occupancyRatePerMinute").default(0).notNull(), // COP/min que EVGreen cobra al usuario en la app (debe ser >= parkingRatePerMinute)
  // ============================================================================
  // ORGANIZACIÓN SaaS - Tenant al que pertenece esta estación
  // null = estación propia de EVGreen (red principal)
  // ============================================================================
  organizationId: int("organization_id"), // FK a organizations (null = red EVGreen principal)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ChargingStation = typeof chargingStations.$inferSelect;
export type InsertChargingStation = typeof chargingStations.$inferInsert;

// ============================================================================
// EVSES (Conectores) TABLE
// ============================================================================

export const evses = mysqlTable("evses", {
  id: int("id").autoincrement().primaryKey(),
  stationId: int("stationId").notNull(), // FK a charging_stations
  // Identificador local dentro de la estación (1, 2, 3...)
  evseIdLocal: int("evseIdLocal").notNull(),
  connectorId: int("connectorId").default(1).notNull(),
  // Tipo de conector según normativa colombiana
  connectorType: connectorTypeEnum.notNull(),
  chargeType: chargeTypeEnum.notNull(), // AC o DC
  // Potencia
  powerKw: decimal("powerKw", { precision: 8, scale: 2 }).notNull(),
  maxVoltage: int("maxVoltage"),
  maxAmperage: int("maxAmperage"),
  // Estado actual (según OCPI)
  status: connectorStatusEnum.default("UNAVAILABLE").notNull(),
  lastStatusUpdate: timestamp("lastStatusUpdate").defaultNow().notNull(),
  // Información de la sesión actual
  currentTransactionId: int("currentTransactionId"),
  currentUserId: int("currentUserId"),
  // Configuración
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Evse = typeof evses.$inferSelect;
export type InsertEvse = typeof evses.$inferInsert;

// ============================================================================
// TARIFFS TABLE
// ============================================================================

export const tariffs = mysqlTable("tariffs", {
  id: int("id").autoincrement().primaryKey(),
  stationId: int("stationId").notNull(), // FK a charging_stations
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  // Precios (en COP - Pesos Colombianos)
  pricePerKwh: decimal("pricePerKwh", { precision: 10, scale: 2 }).notNull(), // $/kWh
  pricePerMinute: decimal("pricePerMinute", { precision: 10, scale: 2 }).default("0"), // $/minuto
  pricePerSession: decimal("pricePerSession", { precision: 10, scale: 2 }).default("0"), // Cargo fijo por sesión
  // Penalizaciones
  reservationFee: decimal("reservationFee", { precision: 10, scale: 2 }).default("0"), // Cargo por reserva
  noShowPenalty: decimal("noShowPenalty", { precision: 10, scale: 2 }).default("0"), // Penalización por no presentarse
  overstayPenaltyPerMinute: decimal("overstayPenaltyPerMinute", { precision: 10, scale: 2 }).default("0"), // $/min después de cargar
  overstayGracePeriodMinutes: int("overstayGracePeriodMinutes").default(10), // Minutos de gracia
  // Horarios especiales (JSON para tarifas por hora)
  timeBasedPricing: json("timeBasedPricing"), // { "peak": { hours: [18,19,20], multiplier: 1.5 } }
  // Precio automático por IA
  autoPricing: boolean("autoPricing").default(false).notNull(), // Si true, usa algoritmo dinámico de IA
  priceMinKwh: decimal("priceMinKwh", { precision: 10, scale: 2 }).default("1000"), // Precio mínimo por kWh cuando IA está activa
  priceMaxKwh: decimal("priceMaxKwh", { precision: 10, scale: 2 }).default("3000"), // Precio máximo por kWh cuando IA está activa
  connectionFee: decimal("connectionFee", { precision: 10, scale: 2 }).default("0"), // Cargo fijo por conectar el vehículo
  // Validez
  isActive: boolean("isActive").default(true).notNull(),
  validFrom: timestamp("validFrom"),
  validTo: timestamp("validTo"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Tariff = typeof tariffs.$inferSelect;
export type InsertTariff = typeof tariffs.$inferInsert;

// ============================================================================
// TRANSACTIONS TABLE
// ============================================================================

export const transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  evseId: int("evseId").notNull(), // FK a evses
  userId: int("userId").notNull(), // FK a users
  stationId: int("stationId").notNull(), // FK a charging_stations (denormalizado para consultas rápidas)
  tariffId: int("tariffId"), // FK a tariffs
  // Identificador OCPP de la transacción
  ocppTransactionId: varchar("ocppTransactionId", { length: 100 }),
  // ID numérico OCPP 1.6 (el que se devuelve al cargador en StartTransaction.conf)
  ocppNumericTxId: int("ocppNumericTxId"),
  // Tiempos
  startTime: timestamp("startTime").notNull(),
  endTime: timestamp("endTime"),
  // Consumo
  kwhConsumed: decimal("kwhConsumed", { precision: 10, scale: 4 }).default("0"),
  meterStart: decimal("meterStart", { precision: 12, scale: 4 }),
  meterEnd: decimal("meterEnd", { precision: 12, scale: 4 }),
  // Costos (en COP)
  energyCost: decimal("energyCost", { precision: 12, scale: 2 }).default("0"),
  timeCost: decimal("timeCost", { precision: 12, scale: 2 }).default("0"),
  sessionCost: decimal("sessionCost", { precision: 12, scale: 2 }).default("0"),
  overstayCost: decimal("overstayCost", { precision: 12, scale: 2 }).default("0"),
  totalCost: decimal("totalCost", { precision: 12, scale: 2 }).default("0"),
  // Distribución de ingresos (modelo 80/20)
  investorShare: decimal("investorShare", { precision: 12, scale: 2 }).default("0"), // 80%
  platformFee: decimal("platformFee", { precision: 12, scale: 2 }).default("0"), // 20%
  // Estado
  status: transactionStatusEnum.default("PENDING").notNull(),
  // Método de inicio
  startMethod: varchar("startMethod", { length: 50 }), // QR, NFC, APP, RFID
  stopReason: varchar("stopReason", { length: 100 }), // REMOTE, LOCAL, ENERGY_LIMIT, etc.
  // SoC manual ingresado por el usuario (cuando el cargador no lo reporta)
  manualSoc: int("manualSoc"), // Porcentaje de batería ingresado manualmente (0-100)
  manualBatteryCapacityKwh: decimal("manualBatteryCapacityKwh", { precision: 6, scale: 2 }), // Capacidad de batería en kWh
  // Modo de carga y valor objetivo (para restaurar sesión desde BD)
  chargeMode: varchar("chargeMode", { length: 20 }).default("full_charge"), // fixed_amount, percentage, full_charge
  targetValue: decimal("targetValue", { precision: 12, scale: 2 }).default("0"), // $ para fixed_amount, % para percentage, 0 para full_charge
  // Precio dinámico aplicado al momento de iniciar la carga (incluye tarifa dinámica IA)
  appliedPricePerKwh: decimal("appliedPricePerKwh", { precision: 10, scale: 2 }),
  // Reserva asociada (si aplica)
  reservationId: int("reservationId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;

// ============================================================================
// METER VALUES TABLE
// ============================================================================

export const meterValues = mysqlTable("meter_values", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  transactionId: int("transactionId").notNull(), // FK a transactions
  evseId: int("evseId").notNull(), // FK a evses
  timestamp: timestamp("timestamp").notNull(),
  // Valores de medición
  energyKwh: decimal("energyKwh", { precision: 12, scale: 4 }),
  powerKw: decimal("powerKw", { precision: 8, scale: 2 }),
  voltage: decimal("voltage", { precision: 6, scale: 2 }),
  current: decimal("current", { precision: 6, scale: 2 }),
  soc: int("soc"), // State of Charge del vehículo (%)
  temperature: decimal("temperature", { precision: 5, scale: 2 }),
  // Contexto OCPP
  context: varchar("context", { length: 50 }), // Sample.Periodic, Transaction.Begin, etc.
  measurand: varchar("measurand", { length: 100 }), // Energy.Active.Import.Register, etc.
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MeterValue = typeof meterValues.$inferSelect;
export type InsertMeterValue = typeof meterValues.$inferInsert;

// ============================================================================
// RESERVATIONS TABLE
// ============================================================================

export const reservations = mysqlTable("reservations", {
  id: int("id").autoincrement().primaryKey(),
  evseId: int("evseId").notNull(), // FK a evses
  userId: int("userId").notNull(), // FK a users
  stationId: int("stationId").notNull(), // FK a charging_stations
  // Tiempos de reserva
  startTime: timestamp("startTime").notNull(),
  endTime: timestamp("endTime").notNull(),
  expiryTime: timestamp("expiryTime").notNull(), // Tiempo máximo para llegar
  // Estado
  status: reservationStatusEnum.default("ACTIVE").notNull(),
  // Costos
  reservationFee: decimal("reservationFee", { precision: 10, scale: 2 }).default("0"),
  noShowPenalty: decimal("noShowPenalty", { precision: 10, scale: 2 }).default("0"),
  isPenaltyApplied: boolean("isPenaltyApplied").default(false).notNull(),
  // Transacción asociada
  transactionId: int("transactionId"),
  // OCPP reservation ID
  ocppReservationId: int("ocppReservationId"),
  // Recordatorios enviados
  reminder30MinSent: timestamp("reminder30MinSent"),
  reminder5MinSent: timestamp("reminder5MinSent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Reservation = typeof reservations.$inferSelect;
export type InsertReservation = typeof reservations.$inferInsert;

// ============================================================================
// WALLETS TABLE
// ============================================================================

export const wallets = mysqlTable("wallets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(), // FK a users
  balance: decimal("balance", { precision: 12, scale: 2 }).default("0").notNull(),
  currency: varchar("currency", { length: 3 }).default("COP").notNull(),
  // Límites
  creditLimit: decimal("creditLimit", { precision: 12, scale: 2 }).default("0"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Wallet = typeof wallets.$inferSelect;
export type InsertWallet = typeof wallets.$inferInsert;

// ============================================================================
// WALLET TRANSACTIONS TABLE
// ============================================================================

export const walletTransactions = mysqlTable("wallet_transactions", {
  id: int("id").autoincrement().primaryKey(),
  walletId: int("walletId").notNull(), // FK a wallets
  userId: int("userId").notNull(), // FK a users
  // Tipo de transacción
  type: varchar("type", { length: 50 }).notNull(), // RECHARGE, CHARGE_PAYMENT, RESERVATION, PENALTY, REFUND, SUBSCRIPTION
  // Montos
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  balanceBefore: decimal("balanceBefore", { precision: 12, scale: 2 }).notNull(),
  balanceAfter: decimal("balanceAfter", { precision: 12, scale: 2 }).notNull(),
  // Referencia
  referenceId: int("referenceId"), // ID de la transacción de carga, reserva, etc.
  referenceType: varchar("referenceType", { length: 50 }), // TRANSACTION, RESERVATION, SUBSCRIPTION
  // Estado
  status: paymentStatusEnum.default("PENDING").notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WalletTransaction = typeof walletTransactions.$inferSelect;
export type InsertWalletTransaction = typeof walletTransactions.$inferInsert;

// ============================================================================
// SUBSCRIPTIONS TABLE
// ============================================================================

export const subscriptions = mysqlTable("subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // FK a users
  tier: subscriptionTierEnum.default("FREE").notNull(),
  // Beneficios
  discountPercentage: decimal("discountPercentage", { precision: 5, scale: 2 }).default("0"),
  freeReservationsPerMonth: int("freeReservationsPerMonth").default(0),
  prioritySupport: boolean("prioritySupport").default(false),
  // Wompi tokenización
  wompiPaymentSourceId: varchar("wompiPaymentSourceId", { length: 100 }),
  wompiCardToken: varchar("wompiCardToken", { length: 100 }),
  cardBrand: varchar("cardBrand", { length: 20 }),
  cardLastFour: varchar("cardLastFour", { length: 4 }),
  cardHolderName: varchar("cardHolderName", { length: 255 }),
  monthlyAmountCents: bigint("monthlyAmountCents", { mode: "number" }).default(0),
  lastPaymentDate: timestamp("lastPaymentDate"),
  lastPaymentReference: varchar("lastPaymentReference", { length: 255 }),
  failedPaymentCount: int("failedPaymentCount").default(0),
  // Auto-recarga durante carga activa
  autoRechargeEnabled: boolean("autoRechargeEnabled").default(false).notNull(),
  autoRechargeThreshold: int("autoRechargeThreshold").default(10000), // Saldo mínimo en COP para trigger
  autoRechargeAmount: int("autoRechargeAmount").default(20000), // Monto a recargar en COP
  lastAutoRechargeAt: timestamp("lastAutoRechargeAt"),
  autoRechargeFailCount: int("autoRechargeFailCount").default(0),
  // Fechas
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate"),
  nextBillingDate: timestamp("nextBillingDate"),
  // Estado
  isActive: boolean("isActive").default(true).notNull(),
  cancelledAt: timestamp("cancelledAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;

// ============================================================================
// MAINTENANCE TICKETS TABLE
// ============================================================================

export const maintenanceTickets = mysqlTable("maintenance_tickets", {
  id: int("id").autoincrement().primaryKey(),
  stationId: int("stationId").notNull(), // FK a charging_stations
  evseId: int("evseId"), // FK a evses (opcional, puede ser de toda la estación)
  technicianId: int("technicianId"), // FK a users (técnico asignado)
  reportedById: int("reportedById"), // FK a users (quien reportó)
  // Detalles
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  priority: varchar("priority", { length: 20 }).default("MEDIUM"), // LOW, MEDIUM, HIGH, CRITICAL
  category: varchar("category", { length: 50 }), // HARDWARE, SOFTWARE, CONNECTIVITY, VANDALISM
  // Estado
  status: maintenanceStatusEnum.default("PENDING").notNull(),
  // Fechas
  scheduledDate: timestamp("scheduledDate"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  // Resolución
  resolution: text("resolution"),
  partsUsed: json("partsUsed"), // [{ name: "Cable", quantity: 1, cost: 50000 }]
  laborCost: decimal("laborCost", { precision: 12, scale: 2 }),
  totalCost: decimal("totalCost", { precision: 12, scale: 2 }),
  // Archivos adjuntos
  attachments: json("attachments"), // URLs de fotos, documentos
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MaintenanceTicket = typeof maintenanceTickets.$inferSelect;
export type InsertMaintenanceTicket = typeof maintenanceTickets.$inferInsert;

// ============================================================================
// OCPP LOGS TABLE (Para debugging y auditoría)
// ============================================================================

export const ocppLogs = mysqlTable("ocpp_logs", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  stationId: int("stationId"), // FK a charging_stations
  ocppIdentity: varchar("ocppIdentity", { length: 100 }),
  direction: varchar("direction", { length: 10 }).notNull(), // IN, OUT
  messageType: varchar("messageType", { length: 50 }).notNull(), // BootNotification, TransactionEvent, etc.
  messageId: varchar("messageId", { length: 100 }),
  payload: json("payload"),
  errorCode: varchar("errorCode", { length: 50 }),
  errorDescription: text("errorDescription"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ([
  // Performance indexes for 1M+ rows
  { name: "idx_ocpp_logs_identity_type_created", columns: [table.ocppIdentity, table.messageType, table.createdAt] },
  { name: "idx_ocpp_logs_created", columns: [table.createdAt] },
]));

export type OcppLog = typeof ocppLogs.$inferSelect;
export type InsertOcppLog = typeof ocppLogs.$inferInsert;

// ============================================================================
// OCPP ALERTS TABLE
// ============================================================================

export const ocppAlertTypeEnum = mysqlEnum("ocpp_alert_type", [
  "DISCONNECTION",
  "ERROR",
  "FAULT",
  "OFFLINE_TIMEOUT",
  "BOOT_REJECTED",
  "TRANSACTION_ERROR",
]);

export const ocppAlertSeverityEnum = mysqlEnum("ocpp_alert_severity", [
  "info",
  "warning",
  "critical",
]);

export const ocppAlerts = mysqlTable("ocpp_alerts", {
  id: int("id").autoincrement().primaryKey(),
  stationId: int("stationId"), // FK a charging_stations
  ocppIdentity: varchar("ocppIdentity", { length: 100 }).notNull(),
  alertType: ocppAlertTypeEnum.notNull(),
  severity: ocppAlertSeverityEnum.notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  payload: json("payload"),
  acknowledged: boolean("acknowledged").default(false).notNull(),
  acknowledgedAt: timestamp("acknowledgedAt"),
  acknowledgedBy: int("acknowledgedBy"), // FK a users
  resolvedAt: timestamp("resolvedAt"),
  autoResolved: boolean("autoResolved").default(false).notNull(),
  resolvedReason: varchar("resolvedReason", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OcppAlert = typeof ocppAlerts.$inferSelect;
export type InsertOcppAlert = typeof ocppAlerts.$inferInsert;

// ============================================================================
// INVESTOR PAYOUTS TABLE
// ============================================================================

export const investorPayouts = mysqlTable("investor_payouts", {
  id: int("id").autoincrement().primaryKey(),
  investorId: int("investorId").notNull(), // FK a users
  // Período
  periodStart: timestamp("periodStart").notNull(),
  periodEnd: timestamp("periodEnd").notNull(),
  // Montos
  totalRevenue: decimal("totalRevenue", { precision: 14, scale: 2 }).notNull(),
  investorShare: decimal("investorShare", { precision: 14, scale: 2 }).notNull(), // Porcentaje del inversionista
  platformFee: decimal("platformFee", { precision: 14, scale: 2 }).notNull(), // Comisión plataforma
  investorPercentage: int("investorPercentage").default(70).notNull(), // Porcentaje aplicado
  // Detalles
  transactionCount: int("transactionCount").notNull(),
  totalKwh: decimal("totalKwh", { precision: 12, scale: 4 }).notNull(),
  // Información bancaria del inversionista al momento de la solicitud
  bankName: varchar("bankName", { length: 100 }),
  bankAccount: varchar("bankAccount", { length: 100 }),
  accountHolder: varchar("accountHolder", { length: 255 }),
  accountType: varchar("accountType", { length: 50 }), // AHORROS, CORRIENTE
  // Estado del pago - Nota: la columna en BD se llama 'status' (renombrada de payment_status)
  status: mysqlEnum("status", ["PENDING", "REQUESTED", "APPROVED", "PROCESSING", "PAID", "REJECTED"]).default("PENDING").notNull(),
  requestedAt: timestamp("requestedAt"), // Cuando el inversionista solicita el pago
  approvedAt: timestamp("approvedAt"), // Cuando admin aprueba
  approvedBy: int("approvedBy"), // FK a users (admin)
  paidAt: timestamp("paidAt"), // Cuando se marca como pagado
  paymentMethod: varchar("paymentMethod", { length: 50 }), // BANK_TRANSFER, STRIPE, WOMPI
  paymentReference: varchar("paymentReference", { length: 100 }), // Número de transferencia
  // Notas
  investorNotes: text("investorNotes"), // Notas del inversionista
  adminNotes: text("adminNotes"), // Notas del admin
  rejectionReason: text("rejectionReason"), // Razón de rechazo si aplica
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type InvestorPayout = typeof investorPayouts.$inferSelect;
export type InsertInvestorPayout = typeof investorPayouts.$inferInsert;

// ============================================================================
// NOTIFICATIONS TABLE
// ============================================================================

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // FK a users
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  type: varchar("type", { length: 50 }).notNull(), // CHARGE_COMPLETE, RESERVATION, PAYMENT, MAINTENANCE, SYSTEM
  // Referencia
  referenceId: int("referenceId"),
  referenceType: varchar("referenceType", { length: 50 }),
  // Estado
  isRead: boolean("isRead").default(false).notNull(),
  readAt: timestamp("readAt"),
  // Push notification
  pushSent: boolean("pushSent").default(false),
  pushSentAt: timestamp("pushSentAt"),
  // Datos adicionales (JSON)
  data: text("data"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// ============================================================================
// SUPPORT TICKETS TABLE
// ============================================================================

export const supportTickets = mysqlTable("support_tickets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // FK a users
  stationId: int("stationId"), // FK a charging_stations (opcional)
  transactionId: int("transactionId"), // FK a transactions (opcional)
  // Detalles
  organizationId: int("organization_id"), // FK a organizations (null = ticket de red principal EVGreen)
  subject: varchar("subject", { length: 255 }).notNull(),
  description: text("description").notNull(),
  category: varchar("category", { length: 50 }), // CHARGING_ISSUE, PAYMENT, APP_BUG, OTHER
  priority: varchar("priority", { length: 20 }).default("MEDIUM"),
  // Estado
  status: varchar("status", { length: 20 }).default("OPEN"), // OPEN, IN_PROGRESS, RESOLVED, CLOSED
  assignedToId: int("assignedToId"), // FK a users (staff)
  // Resolución
  resolution: text("resolution"),
  resolvedAt: timestamp("resolvedAt"),
  // Archivos
  attachments: json("attachments"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SupportTicket = typeof supportTickets.$inferSelect;
export type InsertSupportTicket = typeof supportTickets.$inferInsert;

// ============================================================================
// RELATIONS
// ============================================================================

export const usersRelations = relations(users, ({ many, one }) => ({
  ownedStations: many(chargingStations),
  transactions: many(transactions),
  reservations: many(reservations),
  wallet: one(wallets, {
    fields: [users.id],
    references: [wallets.userId],
  }),
  subscription: one(subscriptions, {
    fields: [users.id],
    references: [subscriptions.userId],
  }),
  notifications: many(notifications),
  supportTickets: many(supportTickets),
  assignedMaintenanceTickets: many(maintenanceTickets),
}));

export const chargingStationsRelations = relations(chargingStations, ({ one, many }) => ({
  owner: one(users, {
    fields: [chargingStations.ownerId],
    references: [users.id],
  }),
  evses: many(evses),
  tariffs: many(tariffs),
  transactions: many(transactions),
  reservations: many(reservations),
  maintenanceTickets: many(maintenanceTickets),
}));

export const evsesRelations = relations(evses, ({ one, many }) => ({
  station: one(chargingStations, {
    fields: [evses.stationId],
    references: [chargingStations.id],
  }),
  transactions: many(transactions),
  reservations: many(reservations),
  meterValues: many(meterValues),
}));

export const transactionsRelations = relations(transactions, ({ one, many }) => ({
  evse: one(evses, {
    fields: [transactions.evseId],
    references: [evses.id],
  }),
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
  station: one(chargingStations, {
    fields: [transactions.stationId],
    references: [chargingStations.id],
  }),
  tariff: one(tariffs, {
    fields: [transactions.tariffId],
    references: [tariffs.id],
  }),
  reservation: one(reservations, {
    fields: [transactions.reservationId],
    references: [reservations.id],
  }),
  meterValues: many(meterValues),
}));

export const reservationsRelations = relations(reservations, ({ one }) => ({
  evse: one(evses, {
    fields: [reservations.evseId],
    references: [evses.id],
  }),
  user: one(users, {
    fields: [reservations.userId],
    references: [users.id],
  }),
  station: one(chargingStations, {
    fields: [reservations.stationId],
    references: [chargingStations.id],
  }),
  transaction: one(transactions, {
    fields: [reservations.transactionId],
    references: [transactions.id],
  }),
}));

export const tariffsRelations = relations(tariffs, ({ one }) => ({
  station: one(chargingStations, {
    fields: [tariffs.stationId],
    references: [chargingStations.id],
  }),
}));

export const meterValuesRelations = relations(meterValues, ({ one }) => ({
  transaction: one(transactions, {
    fields: [meterValues.transactionId],
    references: [transactions.id],
  }),
  evse: one(evses, {
    fields: [meterValues.evseId],
    references: [evses.id],
  }),
}));

export const walletsRelations = relations(wallets, ({ one, many }) => ({
  user: one(users, {
    fields: [wallets.userId],
    references: [users.id],
  }),
  transactions: many(walletTransactions),
}));

export const walletTransactionsRelations = relations(walletTransactions, ({ one }) => ({
  wallet: one(wallets, {
    fields: [walletTransactions.walletId],
    references: [wallets.id],
  }),
  user: one(users, {
    fields: [walletTransactions.userId],
    references: [users.id],
  }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
}));

export const maintenanceTicketsRelations = relations(maintenanceTickets, ({ one }) => ({
  station: one(chargingStations, {
    fields: [maintenanceTickets.stationId],
    references: [chargingStations.id],
  }),
  evse: one(evses, {
    fields: [maintenanceTickets.evseId],
    references: [evses.id],
  }),
  technician: one(users, {
    fields: [maintenanceTickets.technicianId],
    references: [users.id],
  }),
  reportedBy: one(users, {
    fields: [maintenanceTickets.reportedById],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const supportTicketsRelations = relations(supportTickets, ({ one }) => ({
  user: one(users, {
    fields: [supportTickets.userId],
    references: [users.id],
  }),
  station: one(chargingStations, {
    fields: [supportTickets.stationId],
    references: [chargingStations.id],
  }),
  assignedTo: one(users, {
    fields: [supportTickets.assignedToId],
    references: [users.id],
  }),
}));

export const investorPayoutsRelations = relations(investorPayouts, ({ one }) => ({
  investor: one(users, {
    fields: [investorPayouts.investorId],
    references: [users.id],
  }),
}));

// ============================================================================
// BANNERS / ADVERTISEMENTS TABLE
// ============================================================================

export const bannerTypeEnum = mysqlEnum("banner_type", ["SPLASH", "CHARGING", "MAP", "PROMOTIONAL", "INFORMATIONAL"]);
export const bannerStatusEnum = mysqlEnum("banner_status", ["DRAFT", "ACTIVE", "PAUSED", "EXPIRED", "ARCHIVED"]);

export const banners = mysqlTable("banners", {
  id: int("id").autoincrement().primaryKey(),
  // Contenido
  title: varchar("title", { length: 255 }).notNull(),
  subtitle: varchar("subtitle", { length: 500 }),
  description: text("description"),
  imageUrl: text("imageUrl").notNull(),
  imageUrlMobile: text("imageUrlMobile"), // Versión móvil optimizada
  // Tipo y ubicación
  type: mysqlEnum("banner_type", ["SPLASH", "CHARGING", "MAP", "PROMOTIONAL", "INFORMATIONAL"]).notNull(),
  // Enlace y acción
  linkUrl: text("linkUrl"),
  linkType: varchar("linkType", { length: 50 }), // EXTERNAL, INTERNAL, STATION, PROMOTION
  linkTarget: varchar("linkTarget", { length: 50 }), // _blank, _self
  ctaText: varchar("ctaText", { length: 100 }), // Texto del botón de acción
  // Programación
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  // Segmentación
  targetRoles: json("targetRoles"), // ["user", "investor"] - null = todos
  targetCities: json("targetCities"), // ["Bogotá", "Medellín"] - null = todas
  targetSubscriptionTiers: json("targetSubscriptionTiers"), // ["FREE", "PREMIUM"] - null = todos
  // Configuración de visualización
  priority: int("priority").default(0).notNull(), // Mayor = más prioridad
  displayDurationMs: int("displayDurationMs").default(5000), // Duración en splash
  isClosable: boolean("isClosable").default(true),
  showOnce: boolean("showOnce").default(false), // Mostrar solo una vez por usuario
  // Estado
  status: mysqlEnum("banner_status", ["DRAFT", "ACTIVE", "PAUSED", "EXPIRED", "ARCHIVED"]).default("DRAFT").notNull(),
  // Métricas
  impressions: int("impressions").default(0).notNull(),
  clicks: int("clicks").default(0).notNull(),
  uniqueViews: int("uniqueViews").default(0).notNull(),
  // Anunciante (para publicidad externa)
  advertiserName: varchar("advertiserName", { length: 255 }),
  advertiserContact: varchar("advertiserContact", { length: 255 }),
  campaignId: varchar("campaignId", { length: 100 }),
  // Auditoría
  createdById: int("createdById"), // FK a users (staff)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Banner = typeof banners.$inferSelect;
export type InsertBanner = typeof banners.$inferInsert;

// Tabla para rastrear vistas únicas de banners por usuario
export const bannerViews = mysqlTable("banner_views", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  bannerId: int("bannerId").notNull(), // FK a banners
  userId: int("userId").notNull(), // FK a users
  viewedAt: timestamp("viewedAt").defaultNow().notNull(),
  clicked: boolean("clicked").default(false),
  clickedAt: timestamp("clickedAt"),
  // Contexto
  viewContext: varchar("viewContext", { length: 50 }), // SPLASH, CHARGING, MAP
  sessionId: varchar("sessionId", { length: 100 }),
  deviceType: varchar("deviceType", { length: 50 }), // MOBILE, WEB
});

export type BannerView = typeof bannerViews.$inferSelect;
export type InsertBannerView = typeof bannerViews.$inferInsert;

// Relaciones de banners
export const bannersRelations = relations(banners, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [banners.createdById],
    references: [users.id],
  }),
  views: many(bannerViews),
}));

export const bannerViewsRelations = relations(bannerViews, ({ one }) => ({
  banner: one(banners, {
    fields: [bannerViews.bannerId],
    references: [banners.id],
  }),
  user: one(users, {
    fields: [bannerViews.userId],
    references: [users.id],
  }),
}));


// ============================================================================
// AI CONFIGURATION TABLE
// ============================================================================

export const aiProviderEnum = mysqlEnum("ai_provider", [
  "manus",      // Manus LLM integrado (default)
  "openai",     // OpenAI GPT-4, GPT-3.5
  "anthropic",  // Anthropic Claude
  "google",     // Google Gemini
  "azure",      // Azure OpenAI
  "custom",     // Proveedor personalizado
]);

export const aiConfig = mysqlTable("ai_config", {
  id: int("id").autoincrement().primaryKey(),
  // Proveedor activo
  provider: aiProviderEnum.default("manus").notNull(),
  // API Keys (encriptadas en producción)
  openaiApiKey: text("openaiApiKey"),
  anthropicApiKey: text("anthropicApiKey"),
  googleApiKey: text("googleApiKey"),
  azureApiKey: text("azureApiKey"),
  azureEndpoint: text("azureEndpoint"),
  customApiKey: text("customApiKey"),
  customEndpoint: text("customEndpoint"),
  // Configuración de modelo
  modelName: varchar("modelName", { length: 100 }),
  temperature: decimal("temperature", { precision: 3, scale: 2 }).default("0.7"),
  maxTokens: int("maxTokens").default(2000),
  // Funcionalidades habilitadas
  enableChat: boolean("enableChat").default(true).notNull(),
  enableRecommendations: boolean("enableRecommendations").default(true).notNull(),
  enableTripPlanner: boolean("enableTripPlanner").default(true).notNull(),
  enableInvestorInsights: boolean("enableInvestorInsights").default(true).notNull(),
  enableAdminAnalytics: boolean("enableAdminAnalytics").default(true).notNull(),
  // Límites de uso
  dailyUserLimit: int("dailyUserLimit").default(50),
  dailyTotalLimit: int("dailyTotalLimit").default(10000),
  // Metadata
  updatedBy: int("updatedBy"), // FK a users
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AIConfig = typeof aiConfig.$inferSelect;
export type InsertAIConfig = typeof aiConfig.$inferInsert;

// ============================================================================
// AI CONVERSATIONS TABLE
// ============================================================================

export const aiConversations = mysqlTable("ai_conversations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // FK a users
  // Tipo de conversación
  conversationType: varchar("conversationType", { length: 50 }).default("chat").notNull(),
  // Título generado automáticamente
  title: varchar("title", { length: 255 }),
  // Contexto de la conversación (JSON)
  context: json("context"),
  // Estado
  isActive: boolean("isActive").default(true).notNull(),
  messageCount: int("messageCount").default(0).notNull(),
  // Timestamps
  lastMessageAt: timestamp("lastMessageAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AIConversation = typeof aiConversations.$inferSelect;
export type InsertAIConversation = typeof aiConversations.$inferInsert;

// ============================================================================
// AI MESSAGES TABLE
// ============================================================================

export const aiMessages = mysqlTable("ai_messages", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(), // FK a ai_conversations
  // Rol del mensaje
  role: varchar("role", { length: 20 }).notNull(), // user, assistant, system
  // Contenido
  content: text("content").notNull(),
  // Metadata
  tokenCount: int("tokenCount"),
  provider: varchar("provider", { length: 50 }),
  model: varchar("model", { length: 100 }),
  // Para mensajes de asistente - datos estructurados
  structuredData: json("structuredData"), // Recomendaciones, rutas, etc.
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AIMessage = typeof aiMessages.$inferSelect;
export type InsertAIMessage = typeof aiMessages.$inferInsert;

// ============================================================================
// AI USAGE TRACKING TABLE
// ============================================================================

export const aiUsage = mysqlTable("ai_usage", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  userId: int("userId").notNull(), // FK a users
  // Tipo de uso
  usageType: varchar("usageType", { length: 50 }).notNull(), // chat, recommendation, trip_plan, insight
  // Proveedor y modelo usado
  provider: varchar("provider", { length: 50 }).notNull(),
  model: varchar("model", { length: 100 }),
  // Tokens consumidos
  inputTokens: int("inputTokens").default(0),
  outputTokens: int("outputTokens").default(0),
  totalTokens: int("totalTokens").default(0),
  // Costo estimado (USD)
  estimatedCost: decimal("estimatedCost", { precision: 10, scale: 6 }),
  // Timestamp
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AIUsage = typeof aiUsage.$inferSelect;
export type InsertAIUsage = typeof aiUsage.$inferInsert;

// ============================================================================
// AI RELATIONS
// ============================================================================

export const aiConversationsRelations = relations(aiConversations, ({ one, many }) => ({
  user: one(users, {
    fields: [aiConversations.userId],
    references: [users.id],
  }),
  messages: many(aiMessages),
}));

export const aiMessagesRelations = relations(aiMessages, ({ one }) => ({
  conversation: one(aiConversations, {
    fields: [aiMessages.conversationId],
    references: [aiConversations.id],
  }),
}));

export const aiUsageRelations = relations(aiUsage, ({ one }) => ({
  user: one(users, {
    fields: [aiUsage.userId],
    references: [users.id],
  }),
}));


// ============================================================================
// PLATFORM SETTINGS TABLE
// ============================================================================

export const platformSettings = mysqlTable("platform_settings", {
  id: int("id").autoincrement().primaryKey(),
  
  // Información de la empresa
  companyName: varchar("companyName", { length: 255 }).default("Green House Project"),
  businessLine: varchar("businessLine", { length: 255 }).default("Green EV"),
  nit: varchar("nit", { length: 50 }),
  contactEmail: varchar("contactEmail", { length: 255 }),
  
  // Modelo de negocio (porcentajes)
  investorPercentage: int("investorPercentage").default(70).notNull(),
  platformFeePercentage: int("platformFeePercentage").default(30).notNull(),
  
  // Configuración de Wompi (pasarela de pagos Colombia)
  wompiPublicKey: text("wompiPublicKey"),
  wompiPrivateKey: text("wompiPrivateKey"),
  wompiIntegritySecret: text("wompiIntegritySecret"),
  wompiEventsSecret: text("wompiEventsSecret"),
  wompiTestMode: boolean("wompiTestMode").default(true).notNull(),
  
  // Métodos de ingreso habilitados
  enableEnergyBilling: boolean("enableEnergyBilling").default(true).notNull(),
  enableReservationBilling: boolean("enableReservationBilling").default(true).notNull(),
  enableOccupancyPenalty: boolean("enableOccupancyPenalty").default(true).notNull(),
  
  // Configuración de notificaciones
  notifyChargeComplete: boolean("notifyChargeComplete").default(true).notNull(),
  notifyReservationReminder: boolean("notifyReservationReminder").default(true).notNull(),
  notifyPromotions: boolean("notifyPromotions").default(false).notNull(),
  
  // Integración UPME
  upmeEndpoint: text("upmeEndpoint"),
  upmeToken: text("upmeToken"),
  upmeAutoReport: boolean("upmeAutoReport").default(true).notNull(),
  
  // Configuración OCPP
  ocppPort: int("ocppPort").default(9000),
  ocppServerActive: boolean("ocppServerActive").default(true).notNull(),
  
  // Rangos de precio dinámico (controlados por admin para proteger el mercado)
  minPricePerKwh: decimal("minPricePerKwh", { precision: 10, scale: 2 }).default("400").notNull(), // Mínimo $400 COP/kWh
  maxPricePerKwh: decimal("maxPricePerKwh", { precision: 10, scale: 2 }).default("2500").notNull(), // Máximo $2,500 COP/kWh
  enableDynamicPricing: boolean("enableDynamicPricing").default(true).notNull(), // Habilitar precios dinámicos globalmente
  defaultBasePricePerKwh: decimal("defaultBasePricePerKwh", { precision: 10, scale: 2 }).default("1200").notNull(), // Precio base por kWh (editable por admin)
  
  // Tarifas globales por defecto (configurables por admin)
  defaultReservationFee: decimal("defaultReservationFee", { precision: 10, scale: 2 }).default("5000").notNull(), // Fee de reserva por defecto
  defaultOverstayPenaltyPerMin: decimal("defaultOverstayPenaltyPerMin", { precision: 10, scale: 2 }).default("500").notNull(), // Penalización por minuto
  defaultOverstayGracePeriodMinutes: int("defaultOverstayGracePeriodMinutes").default(10).notNull(), // Período de gracia antes de cobrar ocupación (minutos)
  defaultConnectionFee: decimal("defaultConnectionFee", { precision: 10, scale: 2 }).default("2000").notNull(), // Tarifa de conexión
  
  // Tarifas diferenciadas por tipo de conector (AC vs DC)
  defaultPricePerKwhAC: decimal("defaultPricePerKwhAC", { precision: 10, scale: 2 }).default("800").notNull(), // Precio base AC (carga lenta)
  defaultPricePerKwhDC: decimal("defaultPricePerKwhDC", { precision: 10, scale: 2 }).default("1200").notNull(), // Precio base DC (carga rápida)
  enableDifferentiatedPricing: boolean("enableDifferentiatedPricing").default(true).notNull(), // Habilitar precios diferenciados AC/DC
  
  // ============================================================================
  // Configuración de la Calculadora de Inversión (página /investors)
  // ============================================================================
  
  // Factor de utilización premium para estaciones colectivas (multiplicador)
  // Refleja que ubicaciones premium tienen mayor demanda vs ubicaciones estándar
  factorUtilizacionPremium: decimal("factorUtilizacionPremium", { precision: 4, scale: 2 }).default("2.00").notNull(),
  
  // Costos operativos diferenciados por tipo de paquete (%)
  costosOperativosIndividual: int("costosOperativosIndividual").default(15).notNull(), // 15% para individual
  costosOperativosColectivo: int("costosOperativosColectivo").default(10).notNull(), // 10% para colectivo (economías de escala)
  costosOperativosAC: int("costosOperativosAC").default(15).notNull(), // 15% para AC
  
  // Eficiencia de carga por tipo (%)
  eficienciaCargaDC: int("eficienciaCargaDC").default(92).notNull(), // 92% eficiencia DC
  eficienciaCargaAC: int("eficienciaCargaAC").default(95).notNull(), // 95% eficiencia AC
  
  // Costos de energía (COP/kWh)
  costoEnergiaRed: int("costoEnergiaRed").default(850).notNull(), // Costo promedio red eléctrica
  costoEnergiaSolar: int("costoEnergiaSolar").default(250).notNull(), // Costo con energía solar
  
  // Precio de venta por defecto (COP/kWh)
  precioVentaDefault: int("precioVentaDefault").default(1800).notNull(),
  precioVentaMin: int("precioVentaMin").default(1400).notNull(),
  precioVentaMax: int("precioVentaMax").default(2200).notNull(),

  // ============================================================================
  // Configuración del Evento de Lanzamiento (invitaciones)
  // ============================================================================
  
  eventName: varchar("eventName", { length: 255 }).default("Gran Lanzamiento Red de Carga EVGreen"),
  eventDate: varchar("eventDate", { length: 100 }).default("Por confirmar"),
  eventTime: varchar("eventTime", { length: 100 }).default("Por confirmar"),
  eventVenueName: varchar("eventVenueName", { length: 255 }).default("Por confirmar"),
  eventAddress: varchar("eventAddress", { length: 500 }).default("Bogotá, Colombia"),
  eventCity: varchar("eventCity", { length: 100 }).default("Bogotá"),
  eventContactPhone: varchar("eventContactPhone", { length: 50 }),
  eventContactEmail: varchar("eventContactEmail", { length: 255 }).default("evgreen@greenhproject.com"),
  eventGoogleMapsUrl: text("eventGoogleMapsUrl"),
  eventWazeUrl: text("eventWazeUrl"),
  eventDressCode: varchar("eventDressCode", { length: 100 }).default("Business Casual"),
  eventDescription: text("eventDescription"),
  eventMaxGuests: int("eventMaxGuests").default(30),
  eventBgImageUrl: text("eventBgImageUrl"),

  // ============================================================================
  // Configuración de Alegra (Facturación Electrónica DIAN)
  // ============================================================================
  alegraEmail: varchar("alegraEmail", { length: 255 }), // Email de la cuenta Alegra
  alegraToken: text("alegraToken"), // Token de API de Alegra
  alegraEnabled: boolean("alegraEnabled").default(false).notNull(),
  alegraTestMode: boolean("alegraTestMode").default(true).notNull(),
  alegraDefaultItemId: varchar("alegraDefaultItemId", { length: 50 }), // ID del ítem "Servicio de carga EV" en Alegra
  alegraDefaultTaxId: varchar("alegraDefaultTaxId", { length: 50 }), // ID del impuesto (IVA excluido)
  alegraAutoInvoice: boolean("alegraAutoInvoice").default(true).notNull(), // Emitir factura automáticamente al completar carga
  alegraPaymentMethodId: varchar("alegraPaymentMethodId", { length: 50 }), // ID del medio de pago en Alegra
  alegraPaymentAccountId: varchar("alegraPaymentAccountId", { length: 50 }), // ID de la cuenta bancaria en Alegra
  alegraResolutionNumber: varchar("alegraResolutionNumber", { length: 100 }), // Número de resolución DIAN
  
  // Configuración de Soporte
  supportEmail: varchar("supportEmail", { length: 255 }).default("soporte@greenhproject.com"), // Email buzón de soporte
  supportPhone: varchar("supportPhone", { length: 50 }).default("+573001234567"), // Teléfono de soporte
  supportAutoAssign: boolean("supportAutoAssign").default(true).notNull(), // Asignar tickets automáticamente

  // Metadata
  updatedBy: int("updatedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PlatformSettings = typeof platformSettings.$inferSelect;
export type InsertPlatformSettings = typeof platformSettings.$inferInsert;


// ============================================================================
// PRICE HISTORY TABLE (para tracking de precios dinámicos)
// ============================================================================

export const priceHistory = mysqlTable("price_history", {
  id: int("id").autoincrement().primaryKey(),
  stationId: int("stationId").notNull(), // FK a charging_stations
  evseId: int("evseId"), // FK a evses (opcional)
  
  // Precio registrado
  pricePerKwh: decimal("pricePerKwh", { precision: 10, scale: 2 }).notNull(),
  
  // Factores que influyeron en el precio
  demandLevel: varchar("demandLevel", { length: 20 }).notNull(), // LOW, NORMAL, HIGH, SURGE
  occupancyRate: decimal("occupancyRate", { precision: 5, scale: 2 }), // 0-100%
  timeMultiplier: decimal("timeMultiplier", { precision: 4, scale: 2 }),
  dayMultiplier: decimal("dayMultiplier", { precision: 4, scale: 2 }),
  finalMultiplier: decimal("finalMultiplier", { precision: 4, scale: 2 }),
  
  // Contexto
  isAutoPricing: boolean("isAutoPricing").default(true).notNull(), // Si fue precio automático o manual
  transactionId: int("transactionId"), // FK a transactions (si se registró durante una carga)
  
  // Timestamp
  recordedAt: timestamp("recordedAt").defaultNow().notNull(),
});

export type PriceHistory = typeof priceHistory.$inferSelect;
export type InsertPriceHistory = typeof priceHistory.$inferInsert;


// ============================================================================
// CROWDFUNDING - PROYECTOS DE INVERSIÓN COLECTIVA
// ============================================================================

export const crowdfundingStatusEnum = mysqlEnum("status", [
  "DRAFT",           // Borrador, no visible
  "OPEN",            // Abierto para inversiones
  "IN_PROGRESS",     // En financiamiento activo
  "FUNDED",          // Meta alcanzada
  "BUILDING",        // En construcción
  "OPERATIONAL",     // Estación operativa
  "CLOSED",          // Cerrado (cancelado o completado)
]);

export const crowdfundingProjects = mysqlTable("crowdfunding_projects", {
  id: int("id").autoincrement().primaryKey(),
  
  // Información del proyecto
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  city: varchar("city", { length: 100 }).notNull(),
  zone: varchar("zone", { length: 255 }).notNull(),
  address: varchar("address", { length: 500 }),
  
  // Meta de inversión
  targetAmount: bigint("targetAmount", { mode: "number" }).notNull(), // Meta en COP
  raisedAmount: bigint("raisedAmount", { mode: "number" }).default(0).notNull(), // Monto recaudado
  minimumInvestment: bigint("minimumInvestment", { mode: "number" }).default(50000000).notNull(), // Inversión mínima
  
  // Especificaciones técnicas
  totalPowerKw: int("totalPowerKw").default(480).notNull(), // Potencia total en kW
  chargerCount: int("chargerCount").default(4).notNull(), // Número de cargadores
  chargerPowerKw: int("chargerPowerKw").default(120).notNull(), // Potencia por cargador
  hasSolarPanels: boolean("hasSolarPanels").default(true).notNull(),
  
  // Proyecciones financieras
  estimatedRoiPercent: decimal("estimatedRoiPercent", { precision: 5, scale: 2 }).default("85.00"),
  estimatedPaybackMonths: int("estimatedPaybackMonths").default(14),
  
  // Estado y fechas
  status: crowdfundingStatusEnum.default("DRAFT").notNull(),
  targetDate: timestamp("targetDate"), // Fecha objetivo de cierre
  launchDate: timestamp("launchDate"), // Fecha de lanzamiento
  fundedDate: timestamp("fundedDate"), // Fecha en que se alcanzó la meta
  operationalDate: timestamp("operationalDate"), // Fecha de inicio de operaciones
  
  // Prioridad y orden
  priority: int("priority").default(0).notNull(),
  
  // Relación con espacio postulado (origen del proyecto)
  spaceSubmissionId: int("spaceSubmissionId"), // FK a space_submissions
  
  // Relación con estación (cuando se construye)
  stationId: int("stationId"), // FK a charging_stations (cuando esté operativa)
  
  // Metadata
  createdById: int("createdById"), // FK a users (admin)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CrowdfundingProject = typeof crowdfundingProjects.$inferSelect;
export type InsertCrowdfundingProject = typeof crowdfundingProjects.$inferInsert;

// ============================================================================
// CROWDFUNDING - PARTICIPACIONES DE INVERSIONISTAS
// ============================================================================

export const crowdfundingParticipations = mysqlTable("crowdfunding_participations", {
  id: int("id").autoincrement().primaryKey(),
  
  // Relaciones
  projectId: int("projectId").notNull(), // FK a crowdfunding_projects
  investorId: int("investorId").notNull(), // FK a users
  
  // Monto de inversión
  amount: bigint("amount", { mode: "number" }).notNull(), // Monto invertido en COP
  participationPercent: decimal("participationPercent", { precision: 6, scale: 4 }).notNull(), // % de participación
  
  // Estado del pago
  paymentStatus: mysqlEnum("paymentStatus", ["PENDING", "COMPLETED", "FAILED", "REFUNDED"]).default("PENDING").notNull(),
  paymentDate: timestamp("paymentDate"),
  paymentReference: varchar("paymentReference", { length: 255 }), // Referencia de pago (Wompi, transferencia, etc.)
  
  // Contrato y documentos
  contractSigned: boolean("contractSigned").default(false).notNull(),
  contractSignedAt: timestamp("contractSignedAt"),
  contractUrl: text("contractUrl"),
  
  // Metadata
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CrowdfundingParticipation = typeof crowdfundingParticipations.$inferSelect;
export type InsertCrowdfundingParticipation = typeof crowdfundingParticipations.$inferInsert;

// ============================================================================
// CROWDFUNDING RELATIONS
// ============================================================================

export const crowdfundingProjectsRelations = relations(crowdfundingProjects, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [crowdfundingProjects.createdById],
    references: [users.id],
  }),
  station: one(chargingStations, {
    fields: [crowdfundingProjects.stationId],
    references: [chargingStations.id],
  }),
  participations: many(crowdfundingParticipations),
}));

export const crowdfundingParticipationsRelations = relations(crowdfundingParticipations, ({ one }) => ({
  project: one(crowdfundingProjects, {
    fields: [crowdfundingParticipations.projectId],
    references: [crowdfundingProjects.id],
  }),
  investor: one(users, {
    fields: [crowdfundingParticipations.investorId],
    references: [users.id],
  }),
}));


// ============================================================================
// EVENT MANAGEMENT - INVITADOS Y ASISTENCIA
// ============================================================================

export const eventGuestStatusEnum = mysqlEnum("event_guest_status", [
  "INVITED",        // Invitación enviada
  "CONFIRMED",      // Confirmó asistencia
  "CHECKED_IN",     // Registrado en el evento
  "NO_SHOW",        // No se presentó
  "CANCELLED",      // Canceló
]);

export const eventPaymentStatusEnum = mysqlEnum("event_payment_status", [
  "PENDING",        // Pendiente de pago
  "PAID",           // Pagado
  "PARTIAL",        // Pago parcial
  "REFUNDED",       // Reembolsado
]);

export const eventGuests = mysqlTable("event_guests", {
  id: int("id").autoincrement().primaryKey(),
  
  // Datos del invitado
  fullName: varchar("fullName", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  company: varchar("company", { length: 255 }),
  position: varchar("position", { length: 255 }),
  
  // Código QR único para check-in
  qrCode: varchar("qrCode", { length: 100 }).notNull().unique(),
  
  // Paquete de inversión de interés
  investmentPackage: mysqlEnum("investment_package", ["AC", "DC_INDIVIDUAL", "COLECTIVO"]),
  investmentAmount: bigint("investmentAmount", { mode: "number" }),
  
  // Número de cupo fundador (1-30)
  founderSlot: int("founderSlot"),
  
  // Estado
  status: eventGuestStatusEnum.default("INVITED").notNull(),
  
  // Invitación
  invitationSentAt: timestamp("invitationSentAt"),
  invitationEmailId: varchar("invitationEmailId", { length: 255 }),
  
  // Check-in
  checkedInAt: timestamp("checkedInAt"),
  checkedInBy: int("checkedInBy"), // FK a users (staff que registró)
  
  // Relación con usuario (si se crea cuenta)
  userId: int("userId"), // FK a users
  
  // Notas
  notes: text("notes"),
  
  // Creado por (staff)
  createdById: int("createdById"), // FK a users
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EventGuest = typeof eventGuests.$inferSelect;
export type InsertEventGuest = typeof eventGuests.$inferInsert;

// ============================================================================
// EVENT PAYMENTS - PAGOS DE RESERVA DE INVERSIÓN
// ============================================================================

export const eventPayments = mysqlTable("event_payments", {
  id: int("id").autoincrement().primaryKey(),
  
  // Relación con invitado
  guestId: int("guestId").notNull(), // FK a event_guests
  
  // Monto del pago
  amount: bigint("amount", { mode: "number" }).notNull(), // Monto en COP
  reservationDeposit: bigint("reservationDeposit", { mode: "number" }).default(1000000).notNull(), // Depósito mínimo $1M
  
  // Estado del pago
  paymentStatus: eventPaymentStatusEnum.default("PENDING").notNull(),
  
  // Método de pago
  paymentMethod: varchar("paymentMethod", { length: 50 }), // WOMPI, CASH, TRANSFER, CARD
  paymentReference: varchar("paymentReference", { length: 255 }),
  wompiTransactionId: varchar("wompiTransactionId", { length: 255 }),
  
  // Paquete seleccionado
  selectedPackage: mysqlEnum("selected_package", ["AC", "DC_INDIVIDUAL", "COLECTIVO"]).notNull(),
  
  // Beneficios fundador aplicados
  founderBenefits: boolean("founderBenefits").default(true).notNull(),
  founderDiscount: decimal("founderDiscount", { precision: 5, scale: 2 }).default("5.00"), // 5% descuento
  zoneFeeFree: boolean("zoneFeeFree").default(true), // Fee de zona gratis
  
  // Registrado por (staff)
  registeredById: int("registeredById"), // FK a users (staff)
  
  // Timestamps
  paidAt: timestamp("paidAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EventPayment = typeof eventPayments.$inferSelect;
export type InsertEventPayment = typeof eventPayments.$inferInsert;

// ============================================================================
// EVENT RELATIONS
// ============================================================================

export const eventGuestsRelations = relations(eventGuests, ({ one, many }) => ({
  checkedInByUser: one(users, {
    fields: [eventGuests.checkedInBy],
    references: [users.id],
  }),
  createdBy: one(users, {
    fields: [eventGuests.createdById],
    references: [users.id],
  }),
  linkedUser: one(users, {
    fields: [eventGuests.userId],
    references: [users.id],
  }),
  payments: many(eventPayments),
}));

export const eventPaymentsRelations = relations(eventPayments, ({ one }) => ({
  guest: one(eventGuests, {
    fields: [eventPayments.guestId],
    references: [eventGuests.id],
  }),
  registeredBy: one(users, {
    fields: [eventPayments.registeredById],
    references: [users.id],
  }),
}));

// ============================================================================
// FAVORITOS DE ESTACIONES
// ============================================================================

export const favoriteStations = mysqlTable("favorite_stations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // FK a users
  stationId: int("stationId").notNull(), // FK a charging_stations
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FavoriteStation = typeof favoriteStations.$inferSelect;
export type InsertFavoriteStation = typeof favoriteStations.$inferInsert;

export const favoriteStationsRelations = relations(favoriteStations, ({ one }) => ({
  user: one(users, {
    fields: [favoriteStations.userId],
    references: [users.id],
  }),
  station: one(chargingStations, {
    fields: [favoriteStations.stationId],
    references: [chargingStations.id],
  }),
}));

// ============================================================================
// WOMPI TRANSACTIONS - Transacciones de pago vía Wompi
// ============================================================================

export const wompiTransactionStatusEnum = mysqlEnum("wompi_tx_status", [
  "PENDING",
  "APPROVED",
  "DECLINED",
  "VOIDED",
  "ERROR",
]);

export const wompiTransactionTypeEnum = mysqlEnum("wompi_tx_type", [
  "WALLET_RECHARGE",     // Recarga de billetera
  "SUBSCRIPTION",        // Pago de suscripción
  "INVESTMENT_DEPOSIT",  // Depósito de inversión
  "OTHER",
]);

export const wompiTransactions = mysqlTable("wompi_transactions", {
  id: int("id").autoincrement().primaryKey(),
  
  // Relación con usuario
  userId: int("userId").notNull(), // FK a users
  
  // Datos de Wompi
  wompiTransactionId: varchar("wompiTransactionId", { length: 255 }).unique(), // ID de transacción de Wompi
  reference: varchar("reference", { length: 255 }).notNull().unique(), // Referencia única generada por nosotros
  
  // Montos
  amountInCents: bigint("amountInCents", { mode: "number" }).notNull(), // Monto en centavos COP
  currency: varchar("currency", { length: 3 }).default("COP").notNull(),
  
  // Estado y tipo
  status: wompiTransactionStatusEnum.default("PENDING").notNull(),
  type: wompiTransactionTypeEnum.notNull(),
  
  // Método de pago (CARD, NEQUI, PSE, BANCOLOMBIA_TRANSFER, etc.)
  paymentMethodType: varchar("paymentMethodType", { length: 50 }),
  
  // Metadata del pago
  customerEmail: varchar("customerEmail", { length: 320 }),
  description: text("description"),
  
  // Firma de integridad generada
  integritySignature: text("integritySignature"),
  
  // Procesamiento
  processedAt: timestamp("processedAt"),
  webhookReceivedAt: timestamp("webhookReceivedAt"),
  
  // Metadata
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WompiTransaction = typeof wompiTransactions.$inferSelect;
export type InsertWompiTransaction = typeof wompiTransactions.$inferInsert;

export const wompiTransactionsRelations = relations(wompiTransactions, ({ one }) => ({
  user: one(users, {
    fields: [wompiTransactions.userId],
    references: [users.id],
  }),
}));


// ============================================================================
// USER VEHICLES TABLE - Vehículos registrados por usuarios
// ============================================================================

export const userVehicles = mysqlTable("user_vehicles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // FK a users

  // Datos del vehículo
  brand: varchar("brand", { length: 100 }).notNull(), // Marca (Tesla, BYD, Renault, etc.)
  model: varchar("model", { length: 100 }).notNull(), // Modelo (Model 3, Dolphin, Zoe, etc.)
  year: int("year"), // Año del vehículo
  licensePlate: varchar("licensePlate", { length: 20 }), // Placa del vehículo

  // Especificaciones de batería
  batteryCapacityKwh: decimal("batteryCapacityKwh", { precision: 6, scale: 2 }), // Capacidad de batería en kWh
  rangeKm: int("rangeKm"), // Autonomía en km

  // Conectores compatibles (JSON array de tipos de conector)
  // Valores: TYPE_1, TYPE_2, CCS_1, CCS_2, CHADEMO, TESLA, GBT_AC, GBT_DC
  connectorTypes: json("connectorTypes").$type<string[]>().notNull(),

  // Velocidad máxima de carga
  maxChargePowerKw: decimal("maxChargePowerKw", { precision: 6, scale: 2 }), // kW máximos que acepta

  // Estado de batería actual (reportado por el usuario)
  batteryLevel: int("batteryLevel"), // Nivel de batería actual (0-100%)
  lastBatteryUpdate: timestamp("lastBatteryUpdate"), // Última actualización del nivel

  // Estado
  isDefault: boolean("isDefault").default(false).notNull(), // Vehículo principal del usuario
  isActive: boolean("isActive").default(true).notNull(),

  // Imagen del vehículo (opcional)
  imageUrl: text("imageUrl"),

  // Notas del usuario
  nickname: varchar("nickname", { length: 100 }), // Apodo del vehículo (ej: "Mi Tesla")

  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserVehicle = typeof userVehicles.$inferSelect;
export type InsertUserVehicle = typeof userVehicles.$inferInsert;

// ============================================================================
// USER VEHICLES RELATIONS
// ============================================================================

export const userVehiclesRelations = relations(userVehicles, ({ one }) => ({
  user: one(users, {
    fields: [userVehicles.userId],
    references: [users.id],
  }),
}));


// ============================================================================
// FIRMWARE UPDATES
// ============================================================================

export const firmwareUpdates = mysqlTable("firmware_updates", {
  id: int("id").primaryKey().autoincrement(),
  stationId: int("station_id").notNull(),
  ocppIdentity: varchar("ocpp_identity", { length: 255 }).notNull(),
  fileName: varchar("file_name", { length: 500 }).notNull(),
  fileSize: int("file_size").notNull(),
  fileUrl: text("file_url").notNull(),
  version: varchar("version", { length: 100 }),
  status: varchar("status", { length: 50 }).notNull().default("PENDING"),
  progress: int("progress").notNull().default(0),
  errorMessage: text("error_message"),
  notes: text("notes"),
  initiatedBy: int("initiated_by"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const firmwareUpdatesRelations = relations(firmwareUpdates, ({ one }) => ({
  station: one(chargingStations, {
    fields: [firmwareUpdates.stationId],
    references: [chargingStations.id],
  }),
  initiator: one(users, {
    fields: [firmwareUpdates.initiatedBy],
    references: [users.id],
  }),
}));


// ============================================================================
// USER LOGIN SESSIONS - Historial de sesiones de inicio de sesión
// ============================================================================

export const userLoginSessions = mysqlTable("user_login_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // FK a users
  
  // Información del dispositivo/navegador
  userAgent: text("userAgent"),
  ipAddress: varchar("ipAddress", { length: 45 }), // IPv4 o IPv6
  
  // Información parseada del user-agent
  deviceType: varchar("deviceType", { length: 20 }), // desktop, mobile, tablet
  browser: varchar("browser", { length: 100 }),
  os: varchar("os", { length: 100 }),
  
  // Ubicación aproximada (basada en IP)
  location: varchar("location", { length: 255 }),
  
  // Estado de la sesión
  isActive: boolean("isActive").default(true).notNull(),
  
  // Timestamps
  loginAt: timestamp("loginAt").defaultNow().notNull(),
  lastActivityAt: timestamp("lastActivityAt").defaultNow().notNull(),
  logoutAt: timestamp("logoutAt"),
});

export type UserLoginSession = typeof userLoginSessions.$inferSelect;
export type InsertUserLoginSession = typeof userLoginSessions.$inferInsert;

export const userLoginSessionsRelations = relations(userLoginSessions, ({ one }) => ({
  user: one(users, {
    fields: [userLoginSessions.userId],
    references: [users.id],
  }),
}));


// ============================================================================
// STATION REVIEWS / CALIFICACIONES
// ============================================================================

export const stationReviews = mysqlTable("station_reviews", {
  id: int("id").primaryKey().autoincrement(),
  stationId: int("station_id").notNull(),
  userId: int("user_id").notNull(),
  rating: int("rating").notNull(), // 1-5
  comment: text("comment"),
  ownerResponse: text("owner_response"),
  ownerResponseAt: timestamp("owner_response_at"),
  isApproved: tinyint("is_approved").notNull().default(1),
  isVisible: tinyint("is_visible").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type StationReview = typeof stationReviews.$inferSelect;
export type InsertStationReview = typeof stationReviews.$inferInsert;

export const stationReviewsRelations = relations(stationReviews, ({ one }) => ({
  station: one(chargingStations, {
    fields: [stationReviews.stationId],
    references: [chargingStations.id],
  }),
  user: one(users, {
    fields: [stationReviews.userId],
    references: [users.id],
  }),
}));

// ============================================================================
// ID TAGS TABLE (RFID / NFC / APP)
// ============================================================================

export const idTagTypeEnum = mysqlEnum("id_tag_type", ["APP", "RFID", "NFC", "REMOTE"]);
export const idTagStatusEnum = mysqlEnum("id_tag_status", ["ACTIVE", "BLOCKED", "EXPIRED", "LOST"]);

export const idTags = mysqlTable("id_tags", {
  id: int("id").autoincrement().primaryKey(),
  // El idTag tal como lo envía el cargador en Authorize/StartTransaction
  idTag: varchar("id_tag", { length: 50 }).notNull().unique(),
  // Usuario propietario de este idTag (puede ser null para tags no asignados)
  userId: int("user_id"),
  // Tipo de tag
  type: idTagTypeEnum.notNull().default("APP"),
  // Estado del tag
  status: idTagStatusEnum.notNull().default("ACTIVE"),
  // Etiqueta descriptiva (ej: "Tarjeta principal", "Tag oficina")
  label: varchar("label", { length: 100 }),
  // Para RFID/NFC: número de serie del tag físico
  serialNumber: varchar("serial_number", { length: 100 }),
  // Fecha de expiración (null = no expira)
  expiresAt: timestamp("expires_at"),
  // Grupo de tags (para empresas que manejan flotas)
  parentIdTag: varchar("parent_id_tag", { length: 50 }),
  // Límites de uso
  maxActiveTransactions: int("max_active_transactions").default(1),
  // Auditoría
  lastUsedAt: timestamp("last_used_at"),
  lastUsedStationId: int("last_used_station_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type IdTag = typeof idTags.$inferSelect;
export type InsertIdTag = typeof idTags.$inferInsert;

export const idTagsRelations = relations(idTags, ({ one }) => ({
  user: one(users, {
    fields: [idTags.userId],
    references: [users.id],
  }),
  lastUsedStation: one(chargingStations, {
    fields: [idTags.lastUsedStationId],
    references: [chargingStations.id],
  }),
}));


// ============================================================================
// CHARGER BRANDS / PROFILES TABLE
// ============================================================================
// Perfiles de configuración por marca/modelo de cargador.
// Permite autoconfigurar estaciones al seleccionar la marca.

export const chargerBrands = mysqlTable("charger_brands", {
  id: int("id").autoincrement().primaryKey(),
  // Identificación de la marca y modelo
  brand: varchar("brand", { length: 100 }).notNull(), // Ej: "Wallbox"
  model: varchar("model", { length: 100 }).notNull(), // Ej: "Pulsar Plus"
  displayName: varchar("displayName", { length: 200 }).notNull(), // Ej: "Wallbox Pulsar Plus"
  imageUrl: text("imageUrl"), // URL de imagen del cargador
  // Protocolo OCPP
  ocppVersion: varchar("ocppVersion", { length: 20 }).notNull().default("1.6"), // "1.6" o "2.0.1"
  ocppPasswordRequired: boolean("ocppPasswordRequired").default(false).notNull(),
  // Tipo de carga y potencia
  chargeType: chargeTypeEnum.notNull(), // AC o DC
  defaultPowerKw: decimal("defaultPowerKw", { precision: 8, scale: 2 }).notNull(),
  maxPowerKw: decimal("maxPowerKw", { precision: 8, scale: 2 }),
  // Corriente configurable
  minChargingCurrentA: int("minChargingCurrentA"), // Ej: 6A para Wallbox
  maxChargingCurrentA: int("maxChargingCurrentA"), // Ej: 32A para Wallbox
  // Voltaje y fases
  defaultVoltage: int("defaultVoltage"), // Ej: 230V
  phases: int("phases").default(1), // 1 = monofásico, 3 = trifásico
  // Conectores soportados (JSON array)
  supportedConnectors: json("supportedConnectors"), // ["TYPE_2", "GBT_AC"]
  // MeterValues - Measurands soportados por OCPP (JSON array)
  supportedMeasurands: json("supportedMeasurands"), // ["Energy.Active.Import.Register", "Current.Import", ...]
  // Unidad de energía que reporta el cargador
  energyUnit: varchar("energyUnit", { length: 10 }).default("Wh").notNull(), // "Wh" o "kWh"
  // Capacidades del cargador
  supportsSoC: boolean("supportsSoC").default(false).notNull(), // ¿Puede leer SoC del vehículo?
  supportsPowerMeasurement: boolean("supportsPowerMeasurement").default(false).notNull(), // ¿Envía Power.Active.Import?
  supportsCurrentMeasurement: boolean("supportsCurrentMeasurement").default(false).notNull(), // ¿Envía Current.Import?
  supportsVoltageMeasurement: boolean("supportsVoltageMeasurement").default(false).notNull(), // ¿Envía Voltage?
  supportsRemoteStart: boolean("supportsRemoteStart").default(true).notNull(),
  supportsRemoteStop: boolean("supportsRemoteStop").default(true).notNull(),
  supportsReset: boolean("supportsReset").default(true).notNull(),
  supportsReservation: boolean("supportsReservation").default(false).notNull(),
  supportsSmartCharging: boolean("supportsSmartCharging").default(false).notNull(),
  supportsFirmwareUpdate: boolean("supportsFirmwareUpdate").default(false).notNull(),
  // Configuración OCPP recomendada (JSON)
  ocppConfig: json("ocppConfig"), // { MeterValueSampleInterval: 30, ... }
  // Intervalo de MeterValues en segundos
  meterValueInterval: int("meterValueInterval").default(30),
  // API Cloud del fabricante (opcional, para datos adicionales como potencia real)
  cloudApiBaseUrl: varchar("cloudApiBaseUrl", { length: 500 }),
  cloudApiAuthMethod: varchar("cloudApiAuthMethod", { length: 50 }), // "basic", "bearer", "oauth2"
  cloudApiDocsUrl: varchar("cloudApiDocsUrl", { length: 500 }),
  // Notas y particularidades
  notes: text("notes"), // Notas técnicas sobre el cargador
  // Estado
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ChargerBrand = typeof chargerBrands.$inferSelect;
export type InsertChargerBrand = typeof chargerBrands.$inferInsert;

// Relación: charging_stations puede tener un chargerBrandId
export const chargerBrandsRelations = relations(chargerBrands, ({ many }) => ({
  stations: many(chargingStations),
}));


// ============================================================================
// TARIFF CHANGE LOG (Historial de cambios de tarifas para auditoría)
// ============================================================================

export const tariffChangeTypeEnum = mysqlEnum("tariff_change_type", [
  "CREATE",       // Tarifa creada
  "UPDATE",       // Tarifa actualizada
  "GLOBAL_UPDATE", // Rangos globales actualizados
  "DEACTIVATE",   // Tarifa desactivada
]);

export const tariffChangeLogs = mysqlTable("tariff_change_logs", {
  id: int("id").autoincrement().primaryKey(),
  
  // Referencia a la tarifa y estación
  tariffId: int("tariffId"),           // FK a tariffs (null para cambios globales)
  stationId: int("stationId"),         // FK a charging_stations (null para cambios globales)
  
  // Quién hizo el cambio
  changedBy: int("changedBy").notNull(), // FK a users
  changedByName: varchar("changedByName", { length: 255 }),
  changedByRole: varchar("changedByRole", { length: 50 }),
  
  // Tipo de cambio
  changeType: tariffChangeTypeEnum.notNull(),
  
  // Valores anteriores y nuevos (JSON)
  previousValues: json("previousValues"), // { pricePerKwh: "1200", ... }
  newValues: json("newValues"),           // { pricePerKwh: "1300", ... }
  
  // Descripción legible del cambio
  description: text("description"),
  
  // Timestamp
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TariffChangeLog = typeof tariffChangeLogs.$inferSelect;
export type InsertTariffChangeLog = typeof tariffChangeLogs.$inferInsert;

export const tariffChangeLogsRelations = relations(tariffChangeLogs, ({ one }) => ({
  tariff: one(tariffs, {
    fields: [tariffChangeLogs.tariffId],
    references: [tariffs.id],
  }),
  station: one(chargingStations, {
    fields: [tariffChangeLogs.stationId],
    references: [chargingStations.id],
  }),
  user: one(users, {
    fields: [tariffChangeLogs.changedBy],
    references: [users.id],
  }),
}));


// ============================================================================
// USER CONSUMPTION PROFILE - Perfil de consumo inteligente (Fase 2 IA)
// ============================================================================

/**
 * Perfil de consumo calculado del usuario. Se actualiza automáticamente
 * después de cada sesión de carga para que la IA aprenda progresivamente.
 */
export const userConsumptionProfile = mysqlTable("user_consumption_profile", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("userId").notNull().unique(),
  // Estadísticas de energía
  totalSessions: int("totalSessions").default(0).notNull(),
  totalKwh: decimal("totalKwh", { precision: 12, scale: 4 }).default("0").notNull(),
  totalSpentCop: decimal("totalSpentCop", { precision: 15, scale: 2 }).default("0").notNull(),
  avgKwhPerSession: decimal("avgKwhPerSession", { precision: 8, scale: 4 }).default("0").notNull(),
  avgCostPerSession: decimal("avgCostPerSession", { precision: 12, scale: 2 }).default("0").notNull(),
  avgSessionDurationMin: int("avgSessionDurationMin").default(0).notNull(),
  // Gasto mensual promedio (últimos 3 meses)
  monthlyAvgSpent: decimal("monthlyAvgSpent", { precision: 12, scale: 2 }).default("0").notNull(),
  monthlyAvgKwh: decimal("monthlyAvgKwh", { precision: 10, scale: 4 }).default("0").notNull(),
  monthlyAvgSessions: decimal("monthlyAvgSessions", { precision: 6, scale: 2 }).default("0").notNull(),
  // Horarios preferidos (JSON: {"preferredHours": [18, 19, 20], "preferredDays": [1,2,3,4,5]})
  preferredHours: json("preferredHours").$type<number[]>().default([]),
  preferredDays: json("preferredDays").$type<number[]>().default([]),
  // Estaciones favoritas top 3 (JSON: [{stationId, name, visits, lastVisit}])
  topStations: json("topStations").$type<Array<{stationId: number; name: string; visits: number; lastVisit: string}>>().default([]),
  // Tipo de carga preferido
  preferredChargeType: varchar("preferredChargeType", { length: 10 }), // AC o DC
  preferredConnectorType: varchar("preferredConnectorType", { length: 20 }), // CCS_2, TYPE_2, etc.
  avgChargePowerKw: decimal("avgChargePowerKw", { precision: 8, scale: 2 }).default("0"),
  // Patrones de comportamiento
  typicalChargeFrequencyDays: decimal("typicalChargeFrequencyDays", { precision: 6, scale: 2 }), // cada cuántos días carga
  lastChargeAt: timestamp("lastChargeAt"),
  nextPredictedChargeAt: timestamp("nextPredictedChargeAt"), // predicción basada en frecuencia
  // Score de usuario (0-100): combina frecuencia, gasto, puntualidad, antigüedad
  userScore: int("userScore").default(0).notNull(),
  scoreBreakdown: json("scoreBreakdown").$type<{frequency: number; spending: number; punctuality: number; loyalty: number}>(),
  // Suscripción recomendada basada en consumo
  recommendedTier: varchar("recommendedTier", { length: 20 }), // FREE, BASIC, PREMIUM, ENTERPRISE
  estimatedMonthlySavingsWithUpgrade: decimal("estimatedMonthlySavingsWithUpgrade", { precision: 10, scale: 2 }).default("0"),
  // --- Perfilamiento IA avanzado (Fase 2) ---
  // Distribución de cargas por hora del día (24 valores)
  hourlyDistribution: json("hourlyDistribution").$type<number[]>(),
  // Distribución por día de la semana (7 valores, 0 = domingo)
  weekdayDistribution: json("weekdayDistribution").$type<number[]>(),
  peakHour: int("peakHour"),
  peakWeekday: int("peakWeekday"),
  sessionsPerWeek: decimal("sessionsPerWeek", { precision: 5, scale: 2 }),
  // Sensibilidad al precio (> 0.3 = sensible → candidato para ofertas valle)
  priceSensitivity: decimal("priceSensitivity", { precision: 4, scale: 3 }),
  avgPricePaidPerKwh: decimal("avgPricePaidPerKwh", { precision: 10, scale: 2 }),
  // Metadatos del cálculo
  sessionsAnalyzed: int("sessionsAnalyzed").default(0).notNull(),
  windowDays: int("windowDays").default(90).notNull(),
  confidence: mysqlEnum("profile_confidence", ["LOW", "MEDIUM", "HIGH"]).default("LOW").notNull(),
  computedAt: timestamp("computedAt").defaultNow(),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserConsumptionProfile = typeof userConsumptionProfile.$inferSelect;
export type InsertUserConsumptionProfile = typeof userConsumptionProfile.$inferInsert;

export const userConsumptionProfileRelations = relations(userConsumptionProfile, ({ one }) => ({
  user: one(users, {
    fields: [userConsumptionProfile.userId],
    references: [users.id],
  }),
}));

// ============================================================================
// STATION DEMAND FORECAST TABLE — Fase 3 IA Predictiva
// ============================================================================

/**
 * Predicciones de demanda por estación, hora del día y día de la semana.
 * Se recalcula periódicamente a partir del historial real de transacciones.
 * Permite al pricing dinámico usar datos reales en vez de estimaciones hardcodeadas.
 */
export const stationDemandForecast = mysqlTable("station_demand_forecast", {
  id: int("id").primaryKey().autoincrement(),
  stationId: int("stationId").notNull(),
  dayOfWeek: int("dayOfWeek").notNull(), // 0=Domingo, 6=Sábado
  hourOfDay: int("hourOfDay").notNull(), // 0-23
  // Estadísticas calculadas del historial
  avgSessionsPerSlot: decimal("avgSessionsPerSlot", { precision: 8, scale: 4 }).default("0"),
  avgOccupancyRate: decimal("avgOccupancyRate", { precision: 5, scale: 2 }).default("0"), // 0-100%
  avgKwhPerSlot: decimal("avgKwhPerSlot", { precision: 10, scale: 4 }).default("0"),
  avgRevenuePerSlot: decimal("avgRevenuePerSlot", { precision: 12, scale: 2 }).default("0"),
  // Tendencia (comparando últimas 4 semanas vs 4 semanas anteriores)
  trend: varchar("trend", { length: 20 }).default("STABLE"), // RISING, STABLE, DECLINING
  trendPercent: decimal("trendPercent", { precision: 6, scale: 2 }).default("0"), // % cambio
  // Multiplicador de demanda sugerido para pricing dinámico
  suggestedDemandMultiplier: decimal("suggestedDemandMultiplier", { precision: 4, scale: 3 }).default("1.000"),
  // Confianza de la predicción (0-100, basada en cantidad de datos)
  confidenceScore: int("confidenceScore").default(0),
  // Datos de muestra
  sampleSize: int("sampleSize").default(0), // Número de semanas con datos
  lastCalculatedAt: timestamp("lastCalculatedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StationDemandForecast = typeof stationDemandForecast.$inferSelect;
export type InsertStationDemandForecast = typeof stationDemandForecast.$inferInsert;

export const stationDemandForecastRelations = relations(stationDemandForecast, ({ one }) => ({
  station: one(chargingStations, {
    fields: [stationDemandForecast.stationId],
    references: [chargingStations.id],
  }),
}));

// ============================================================================
// HISTORIAL DE UBICACIÓN Y PATRONES DE USO DEL USUARIO
// ============================================================================

/**
 * Historial de ubicaciones del usuario (se guarda con cada interacción del chat)
 */
export const userLocationHistory = mysqlTable("user_location_history", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("userId").notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 7 }).notNull(),
  longitude: decimal("longitude", { precision: 10, scale: 7 }).notNull(),
  accuracy: decimal("accuracy", { precision: 8, scale: 2 }), // metros
  source: varchar("source", { length: 50 }).default("chat"), // chat, map, charging, app
  // Dirección reversa (se puede llenar asincrónicamente)
  address: varchar("address", { length: 500 }),
  city: varchar("city", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UserLocationHistory = typeof userLocationHistory.$inferSelect;
export type InsertUserLocationHistory = typeof userLocationHistory.$inferInsert;

/**
 * Patrones de rutas frecuentes detectados automáticamente
 */
export const userRoutePatterns = mysqlTable("user_route_patterns", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("userId").notNull(),
  // Origen frecuente
  originLatitude: decimal("originLatitude", { precision: 10, scale: 7 }).notNull(),
  originLongitude: decimal("originLongitude", { precision: 10, scale: 7 }).notNull(),
  originName: varchar("originName", { length: 200 }), // "Casa", "Oficina", etc.
  originAddress: varchar("originAddress", { length: 500 }),
  // Destino frecuente
  destinationLatitude: decimal("destinationLatitude", { precision: 10, scale: 7 }).notNull(),
  destinationLongitude: decimal("destinationLongitude", { precision: 10, scale: 7 }).notNull(),
  destinationName: varchar("destinationName", { length: 200 }),
  destinationAddress: varchar("destinationAddress", { length: 500 }),
  // Estadísticas
  frequency: int("frequency").default(1).notNull(), // veces que se ha hecho esta ruta
  estimatedDistanceKm: decimal("estimatedDistanceKm", { precision: 8, scale: 2 }),
  averageDurationMinutes: int("averageDurationMinutes"),
  // Horarios típicos
  typicalDepartureHour: int("typicalDepartureHour"), // 0-23
  typicalDays: json("typicalDays"), // [1,2,3,4,5] = lunes a viernes
  // Paradas de carga preferidas en esta ruta
  preferredChargingStops: json("preferredChargingStops"), // [{stationId, name}]
  lastUsed: timestamp("lastUsed").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type UserRoutePattern = typeof userRoutePatterns.$inferSelect;
export type InsertUserRoutePattern = typeof userRoutePatterns.$inferInsert;

// Relaciones
export const userLocationHistoryRelations = relations(userLocationHistory, ({ one }) => ({
  user: one(users, {
    fields: [userLocationHistory.userId],
    references: [users.id],
  }),
}));

export const userRoutePatternsRelations = relations(userRoutePatterns, ({ one }) => ({
  user: one(users, {
    fields: [userRoutePatterns.userId],
    references: [users.id],
  }),
}));


// ============================================================================
// USER DEBTS TABLE - Deudas pendientes por ocupación (overstay)
// ============================================================================

export const debtStatusEnum = mysqlEnum("debt_status", [
  "PENDING",    // Deuda activa, pendiente de pago
  "PAID",       // Pagada completamente
  "PARTIAL",    // Pago parcial realizado
  "WAIVED",     // Condonada por admin
]);

export const userDebts = mysqlTable("user_debts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // FK a users
  transactionId: int("transactionId"), // FK a transactions (la sesión de carga que generó la deuda)
  /** Monto original de la deuda en COP */
  originalAmount: decimal("originalAmount", { precision: 12, scale: 2 }).notNull(),
  /** Monto pendiente por pagar en COP */
  remainingAmount: decimal("remainingAmount", { precision: 12, scale: 2 }).notNull(),
  /** Razón de la deuda */
  reason: varchar("reason", { length: 100 }).notNull(), // "OVERSTAY", "INSUFFICIENT_BALANCE", etc.
  /** Descripción legible */
  description: text("description"),
  /** Estado de la deuda */
  status: debtStatusEnum.default("PENDING").notNull(),
  /** Intentos de cobro automático fallidos */
  autoChargeAttempts: int("autoChargeAttempts").default(0).notNull(),
  /** Último intento de cobro automático */
  lastAutoChargeAt: timestamp("lastAutoChargeAt"),
  /** Referencia de pago (si fue pagada) */
  paymentReference: varchar("paymentReference", { length: 255 }),
  /** Fecha de pago */
  paidAt: timestamp("paidAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type UserDebt = typeof userDebts.$inferSelect;
export type InsertUserDebt = typeof userDebts.$inferInsert;

export const userDebtsRelations = relations(userDebts, ({ one }) => ({
  user: one(users, {
    fields: [userDebts.userId],
    references: [users.id],
  }),
  transaction: one(transactions, {
    fields: [userDebts.transactionId],
    references: [transactions.id],
  }),
}));

// ============================================================
// SOC ACCURACY LOG - Historial de precisión del SoC manual
// ============================================================
export const socAccuracyLog = mysqlTable("soc_accuracy_log", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  transactionId: int("transactionId").notNull().references(() => transactions.id, { onDelete: "cascade" }),
  vehicleId: int("vehicleId").references(() => userVehicles.id, { onDelete: "set null" }),
  /** SoC manual ingresado por el usuario al iniciar (%) */
  manualSocStart: int("manualSocStart").notNull(),
  /** Capacidad de batería ingresada manualmente (kWh) */
  manualBatteryCapacityKwh: float("manualBatteryCapacityKwh").notNull(),
  /** kWh reales entregados por el cargador (OCPP) */
  realKwhDelivered: float("realKwhDelivered").notNull(),
  /** SoC calculado al finalizar basado en kWh reales + capacidad manual */
  calculatedSocEnd: int("calculatedSocEnd"),
  /** SoC reportado por el cargador al finalizar (si disponible) */
  chargerSocEnd: int("chargerSocEnd"),
  /** Si se detectó batería llena por caída de potencia */
  batteryFullDetected: boolean("batteryFullDetected").default(false).notNull(),
  /** Método de detección: 'charger_soc', 'power_drop', 'user_stop', 'target_reached' */
  detectionMethod: varchar("detectionMethod", { length: 50 }),
  /** Error estimado en kWh (real - estimado) */
  estimatedErrorKwh: float("estimatedErrorKwh"),
  /** Error estimado en % de SoC */
  estimatedErrorSocPct: int("estimatedErrorSocPct"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type SocAccuracyLog = typeof socAccuracyLog.$inferSelect;
export type InsertSocAccuracyLog = typeof socAccuracyLog.$inferInsert;
export const socAccuracyLogRelations = relations(socAccuracyLog, ({ one }) => ({
  user: one(users, { fields: [socAccuracyLog.userId], references: [users.id] }),
  transaction: one(transactions, { fields: [socAccuracyLog.transactionId], references: [transactions.id] }),
  vehicle: one(userVehicles, { fields: [socAccuracyLog.vehicleId], references: [userVehicles.id] }),
}));


// ============================================================================
// SUPPORT MESSAGES TABLE (Chat en vivo)
// ============================================================================

export const supportMessages = mysqlTable("support_messages", {
  id: int("id").autoincrement().primaryKey(),
  ticketId: int("ticketId").notNull(), // FK a support_tickets
  senderId: int("senderId").notNull(), // FK a users (puede ser usuario o agente)
  senderRole: varchar("senderRole", { length: 20 }).notNull(), // 'user', 'agent', 'system'
  message: text("message").notNull(),
  attachmentUrl: text("attachmentUrl"), // URL de archivo adjunto (S3)
  readAt: timestamp("readAt"), // Cuándo fue leído por el destinatario
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type SupportMessage = typeof supportMessages.$inferSelect;
export type InsertSupportMessage = typeof supportMessages.$inferInsert;

// ============================================================================
// SUPPORT AGENTS TABLE (Agentes/Técnicos de soporte)
// ============================================================================

export const supportAgents = mysqlTable("support_agents", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // FK a users
  isOnline: boolean("isOnline").default(false).notNull(),
  isAvailable: boolean("isAvailable").default(true).notNull(), // Disponible para nuevas asignaciones
  // Horario de trabajo (formato HH:mm, ej: "08:00")
  scheduleStart: varchar("scheduleStart", { length: 10 }).default("08:00"),
  scheduleEnd: varchar("scheduleEnd", { length: 10 }).default("17:00"),
  // Días laborales (JSON array, ej: [1,2,3,4,5] = Lun-Vie)
  workDays: json("workDays").$type<number[]>().default([1, 2, 3, 4, 5]),
  maxConcurrentTickets: int("maxConcurrentTickets").default(5).notNull(),
  activeTicketCount: int("activeTicketCount").default(0).notNull(),
  lastAssignedAt: timestamp("lastAssignedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type SupportAgent = typeof supportAgents.$inferSelect;
export type InsertSupportAgent = typeof supportAgents.$inferInsert;

// ============================================================================
// CHARGER PROBLEM REPORTS TABLE (Reportes de problemas con cargadores)
// ============================================================================

export const chargerProblemReports = mysqlTable("charger_problem_reports", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // FK a users
  stationId: int("stationId"), // FK a charging_stations
  stationName: varchar("stationName", { length: 255 }),
  connectorId: varchar("connectorId", { length: 50 }), // varchar en BD real
  // Tipo de problema
  problemType: varchar("problemType", { length: 50 }).notNull(),
  // CONNECTOR_DAMAGED, SCREEN_BROKEN, NO_POWER, CABLE_DAMAGED, 
  // PAYMENT_ERROR, SLOW_CHARGING, APP_CONNECTION, OTHER
  description: text("description"),
  photoUrl: varchar("photoUrl", { length: 500 }),
  // Estado
  status: varchar("status", { length: 20 }).default("PENDING").notNull(), // PENDING, REVIEWING, IN_REPAIR, RESOLVED, DISMISSED
  priority: varchar("priority", { length: 20 }).default("MEDIUM").notNull(),
  assignedToId: int("assignedToId"),
  resolution: text("resolution"),
  resolvedAt: timestamp("resolvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ChargerProblemReport = typeof chargerProblemReports.$inferSelect;
export type InsertChargerProblemReport = typeof chargerProblemReports.$inferInsert;

// Relations for support messages
export const supportMessagesRelations = relations(supportMessages, ({ one }) => ({
  ticket: one(supportTickets, { fields: [supportMessages.ticketId], references: [supportTickets.id] }),
  sender: one(users, { fields: [supportMessages.senderId], references: [users.id] }),
}));

// Relations for support agents
export const supportAgentsRelations = relations(supportAgents, ({ one }) => ({
  user: one(users, { fields: [supportAgents.userId], references: [users.id] }),
}));

// Relations for charger problem reports
export const chargerProblemReportsRelations = relations(chargerProblemReports, ({ one }) => ({
  user: one(users, { fields: [chargerProblemReports.userId], references: [users.id] }),
  station: one(chargingStations, { fields: [chargerProblemReports.stationId], references: [chargingStations.id] }),
}));


// ============================================================================
// SISTEMA DE LIQUIDACIÓN FINANCIERA - GASTOS FIJOS, WATERFALL, KPIs
// ============================================================================

// --- Enums ---

export const expenseCategoryEnum = mysqlEnum("expense_category", [
  "ENERGY",        // Costos de energía eléctrica de red
  "INSURANCE",     // Pólizas de seguro (todo riesgo + RC)
  "CONNECTIVITY",  // Internet/comunicaciones
  "MAINTENANCE",   // Mantenimiento preventivo/correctivo
  "FIDUCIARY",     // Comisión fiduciaria
  "TAX",           // Impuestos y tasas locales
  "CONTINGENCY",   // Reserva para contingencias
  "ADMIN",         // Gastos administrativos
  "OTHER",         // Otros gastos
]);

export const expensePeriodicityEnum = mysqlEnum("expense_periodicity", [
  "MONTHLY",
  "BIMONTHLY",
  "QUARTERLY",
  "SEMIANNUAL",
  "ANNUAL",
  "ONE_TIME",
]);

export const settlementPeriodTypeEnum = mysqlEnum("settlement_period_type", [
  "WEEKLY",
  "MONTHLY",
  "QUARTERLY",
]);

export const settlementStatusEnum = mysqlEnum("settlement_status", [
  "DRAFT",        // Borrador, aún editable
  "APPROVED",     // Aprobado por admin
  "DISTRIBUTED",  // Fondos distribuidos a inversionistas
  "CLOSED",       // Cerrado/archivado
]);

export const investorShareStatusEnum = mysqlEnum("investor_share_status", [
  "PENDING",    // Pendiente de acreditar
  "CREDITED",   // Acreditado en billetera
  "PAID",       // Pagado (transferencia bancaria)
]);

export const slaStatusEnum = mysqlEnum("sla_status", [
  "COMPLIANT",  // Cumple todos los KPIs
  "WARNING",    // 1-2 KPIs por debajo del umbral
  "BREACH",     // 3+ KPIs incumplidos
]);

// --- Tablas ---

// ============================================================================
// STATION FIXED EXPENSES - Gastos fijos configurables por estación
// ============================================================================

export const stationFixedExpenses = mysqlTable("station_fixed_expenses", {
  id: int("id").autoincrement().primaryKey(),
  stationId: int("stationId").notNull(), // FK a charging_stations
  
  // Descripción del gasto
  name: varchar("name", { length: 255 }).notNull(), // Ej: "Póliza todo riesgo", "Internet fibra"
  category: expenseCategoryEnum.notNull(),
  description: text("description"),
  
  // Monto y periodicidad
  amountCop: bigint("amountCop", { mode: "number" }).notNull(), // Monto en COP
  periodicity: expensePeriodicityEnum.notNull(),
  
  // Vigencia
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate"), // null = vigente indefinidamente
  
  // Proveedor/referencia
  providerName: varchar("providerName", { length: 255 }),
  contractReference: varchar("contractReference", { length: 255 }),
  
  // Waterfall priority (1 = mayor prioridad, se descuenta primero)
  waterfallPriority: int("waterfallPriority").notNull().default(5),
  
  // Estado
  isActive: boolean("isActive").default(true).notNull(),
  
  // Auditoría
  createdBy: int("createdBy").notNull(), // FK a users (admin que lo creó)
  updatedBy: int("updatedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StationFixedExpense = typeof stationFixedExpenses.$inferSelect;
export type InsertStationFixedExpense = typeof stationFixedExpenses.$inferInsert;

// ============================================================================
// FINANCIAL SETTLEMENTS - Liquidaciones/Cortes financieros por estación
// ============================================================================

export const financialSettlements = mysqlTable("financial_settlements", {
  id: int("id").autoincrement().primaryKey(),
  stationId: int("stationId").notNull(), // FK a charging_stations
  
  // Período de liquidación
  periodStart: timestamp("periodStart").notNull(),
  periodEnd: timestamp("periodEnd").notNull(),
  periodType: settlementPeriodTypeEnum.notNull(),
  
  // Ingresos brutos del período (suma de todas las transacciones de carga)
  grossRevenue: bigint("grossRevenue", { mode: "number" }).notNull().default(0),
  totalSessions: int("totalSessions").notNull().default(0),
  totalKwh: decimal("totalKwh", { precision: 12, scale: 4 }).default("0"),
  
  // Gastos fijos del período (suma de todos los gastos prorrateados)
  totalFixedExpenses: bigint("totalFixedExpenses", { mode: "number" }).notNull().default(0),
  
  // Ingreso neto (grossRevenue - totalFixedExpenses)
  netRevenue: bigint("netRevenue", { mode: "number" }).notNull().default(0),
  
  // Costo de energía del período (kWh consumidos * costo compra/kWh)
  totalEnergyCost: bigint("totalEnergyCost", { mode: "number" }).notNull().default(0),
  energyCostPerKwh: decimal("energyCostPerKwh", { precision: 10, scale: 2 }).default("850.00"),
  
  // Ingresos por fuente (desglose del bruto)
  revenueFromEnergy: bigint("revenueFromEnergy", { mode: "number" }).notNull().default(0),
  revenueFromPenalties: bigint("revenueFromPenalties", { mode: "number" }).notNull().default(0),
  revenueFromReservations: bigint("revenueFromReservations", { mode: "number" }).notNull().default(0),
  revenueFromAdvertising: bigint("revenueFromAdvertising", { mode: "number" }).notNull().default(0),
  
  // Distribución configurable (3 actores)
  investorSharePercent: decimal("investorSharePercent", { precision: 5, scale: 2 }).notNull().default("70.00"),
  platformSharePercent: decimal("platformSharePercent", { precision: 5, scale: 2 }).notNull().default("30.00"),
  hostSharePercent: decimal("hostSharePercent", { precision: 5, scale: 2 }).notNull().default("0.00"),
  investorTotalAmount: bigint("investorTotalAmount", { mode: "number" }).notNull().default(0),
  platformTotalAmount: bigint("platformTotalAmount", { mode: "number" }).notNull().default(0),
  hostTotalAmount: bigint("hostTotalAmount", { mode: "number" }).notNull().default(0),
  // Fondo de mantenimiento (dentro del share de EVGreen)
  maintenanceFundPercent: decimal("maintenanceFundPercent", { precision: 5, scale: 2 }).notNull().default("5.00"),
  maintenanceFundAmount: bigint("maintenanceFundAmount", { mode: "number" }).notNull().default(0),
  platformNetAmount: bigint("platformNetAmount", { mode: "number" }).notNull().default(0), // EVGreen neto (después de fondo mantenimiento)
  
  // Reserva de contingencia (5% del bruto, se resta antes de distribuir)
  contingencyReserve: bigint("contingencyReserve", { mode: "number" }).notNull().default(0),
  
  // Detalle del waterfall (JSON con cada nivel y su monto)
  waterfallBreakdown: json("waterfallBreakdown").$type<Array<{
    priority: number;
    category: string;
    name: string;
    amount: number;
  }>>(),
  
  // Estado
  status: settlementStatusEnum.default("DRAFT").notNull(),
  
  // Aprobación
  approvedBy: int("approvedBy"), // FK a users
  approvedAt: timestamp("approvedAt"),
  distributedAt: timestamp("distributedAt"),
  
  // Notas del admin
  notes: text("notes"),
  
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FinancialSettlement = typeof financialSettlements.$inferSelect;
export type InsertFinancialSettlement = typeof financialSettlements.$inferInsert;

// ============================================================================
// SETTLEMENT EXPENSE ITEMS - Detalle de gastos en cada liquidación
// ============================================================================

export const settlementExpenseItems = mysqlTable("settlement_expense_items", {
  id: int("id").autoincrement().primaryKey(),
  settlementId: int("settlementId").notNull(), // FK a financial_settlements
  expenseId: int("expenseId"), // FK a station_fixed_expenses (null si es gasto manual)
  
  name: varchar("name", { length: 255 }).notNull(),
  category: expenseCategoryEnum.notNull(),
  originalAmount: bigint("originalAmount", { mode: "number" }).notNull(), // Monto original del gasto
  proratedAmount: bigint("proratedAmount", { mode: "number" }).notNull(), // Monto prorrateado al período
  waterfallPriority: int("waterfallPriority").notNull(),
  
  // Si fue prorrateado (ej: gasto anual dividido en meses)
  isProrated: boolean("isProrated").default(false).notNull(),
  prorateFormula: varchar("prorateFormula", { length: 255 }), // Ej: "120000000 / 12 meses"
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SettlementExpenseItem = typeof settlementExpenseItems.$inferSelect;
export type InsertSettlementExpenseItem = typeof settlementExpenseItems.$inferInsert;

// ============================================================================
// INVESTOR SETTLEMENT SHARES - Parte de cada inversionista en una liquidación
// ============================================================================

export const investorSettlementShares = mysqlTable("investor_settlement_shares", {
  id: int("id").autoincrement().primaryKey(),
  settlementId: int("settlementId").notNull(), // FK a financial_settlements
  investorUserId: int("investorUserId").notNull(), // FK a users
  
  // Participación del inversionista
  participationPercent: decimal("participationPercent", { precision: 8, scale: 4 }).notNull(),
  
  // Montos
  grossShare: bigint("grossShare", { mode: "number" }).notNull(), // Parte bruta antes de gastos
  expenseShare: bigint("expenseShare", { mode: "number" }).notNull().default(0), // Parte proporcional de gastos
  netShare: bigint("netShare", { mode: "number" }).notNull(), // Neto a recibir
  
  // Estado
  status: investorShareStatusEnum.default("PENDING").notNull(),
  creditedAt: timestamp("creditedAt"),
  
  // Referencia de pago (si se pagó por transferencia)
  paymentReference: varchar("paymentReference", { length: 255 }),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type InvestorSettlementShare = typeof investorSettlementShares.$inferSelect;
export type InsertInvestorSettlementShare = typeof investorSettlementShares.$inferInsert;

// ============================================================================
// OPERATIONAL METRICS - Métricas operativas SLA por estación/período
// ============================================================================

export const operationalMetrics = mysqlTable("operational_metrics", {
  id: int("id").autoincrement().primaryKey(),
  stationId: int("stationId").notNull(), // FK a charging_stations
  
  // Período de medición
  periodStart: timestamp("periodStart").notNull(),
  periodEnd: timestamp("periodEnd").notNull(),
  
  // KPI 1: Disponibilidad Operativa (meta: 95%)
  // Horas que los cargadores estuvieron activos / horas totales del período
  availabilityPercent: decimal("availabilityPercent", { precision: 5, scale: 2 }).default("0"),
  totalUptimeHours: decimal("totalUptimeHours", { precision: 10, scale: 2 }).default("0"),
  totalDowntimeHours: decimal("totalDowntimeHours", { precision: 10, scale: 2 }).default("0"),
  
  // KPI 2: Respuesta a Fallas Críticas (meta: 24h)
  // Tiempo promedio de respuesta a tickets críticos
  avgCriticalResponseHours: decimal("avgCriticalResponseHours", { precision: 8, scale: 2 }).default("0"),
  criticalTicketsCount: int("criticalTicketsCount").default(0),
  criticalTicketsResolved: int("criticalTicketsResolved").default(0),
  
  // KPI 3: Uptime Plataforma (meta: 99%)
  // Disponibilidad de la plataforma EVGreen
  platformUptimePercent: decimal("platformUptimePercent", { precision: 5, scale: 2 }).default("99.50"),
  
  // KPI 4: Satisfacción del Usuario (meta: 4.0/5)
  // Promedio de calificaciones de usuarios
  userSatisfactionScore: decimal("userSatisfactionScore", { precision: 3, scale: 2 }).default("0"),
  totalReviews: int("totalReviews").default(0),
  
  // KPI 5: Precisión de Facturación (meta: 99.9%)
  // Transacciones correctas / total transacciones
  billingAccuracyPercent: decimal("billingAccuracyPercent", { precision: 5, scale: 2 }).default("100.00"),
  totalTransactions: int("totalTransactions").default(0),
  disputedTransactions: int("disputedTransactions").default(0),
  
  // KPI 6: Generación Solar (meta: 85%)
  // Rendimiento real vs capacidad instalada
  solarGenerationPercent: decimal("solarGenerationPercent", { precision: 5, scale: 2 }).default("0"),
  solarKwhGenerated: decimal("solarKwhGenerated", { precision: 12, scale: 4 }).default("0"),
  solarKwhExpected: decimal("solarKwhExpected", { precision: 12, scale: 4 }).default("0"),
  
  // Estado SLA general
  slaStatus: slaStatusEnum.default("COMPLIANT").notNull(),
  slaBreachCount: int("slaBreachCount").default(0), // Cuántos KPIs están por debajo del umbral
  
  // Consecuencias progresivas
  consecutiveBreachMonths: int("consecutiveBreachMonths").default(0),
  penaltyApplied: varchar("penaltyApplied", { length: 100 }), // "NONE", "IMPROVEMENT_PLAN", "FEE_REDUCTION_10", "DEFAULT_EVENT"
  
  calculatedAt: timestamp("calculatedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type OperationalMetric = typeof operationalMetrics.$inferSelect;
export type InsertOperationalMetric = typeof operationalMetrics.$inferInsert;

// ============================================================================
// RELATIONS - Sistema Financiero
// ============================================================================

export const stationFixedExpensesRelations = relations(stationFixedExpenses, ({ one }) => ({
  station: one(chargingStations, {
    fields: [stationFixedExpenses.stationId],
    references: [chargingStations.id],
  }),
  creator: one(users, {
    fields: [stationFixedExpenses.createdBy],
    references: [users.id],
  }),
}));

export const financialSettlementsRelations = relations(financialSettlements, ({ one, many }) => ({
  station: one(chargingStations, {
    fields: [financialSettlements.stationId],
    references: [chargingStations.id],
  }),
  approver: one(users, {
    fields: [financialSettlements.approvedBy],
    references: [users.id],
  }),
  creator: one(users, {
    fields: [financialSettlements.createdBy],
    references: [users.id],
  }),
  expenseItems: many(settlementExpenseItems),
  investorShares: many(investorSettlementShares),
}));

export const settlementExpenseItemsRelations = relations(settlementExpenseItems, ({ one }) => ({
  settlement: one(financialSettlements, {
    fields: [settlementExpenseItems.settlementId],
    references: [financialSettlements.id],
  }),
  expense: one(stationFixedExpenses, {
    fields: [settlementExpenseItems.expenseId],
    references: [stationFixedExpenses.id],
  }),
}));

export const investorSettlementSharesRelations = relations(investorSettlementShares, ({ one }) => ({
  settlement: one(financialSettlements, {
    fields: [investorSettlementShares.settlementId],
    references: [financialSettlements.id],
  }),
  investor: one(users, {
    fields: [investorSettlementShares.investorUserId],
    references: [users.id],
  }),
}));

export const operationalMetricsRelations = relations(operationalMetrics, ({ one }) => ({
  station: one(chargingStations, {
    fields: [operationalMetrics.stationId],
    references: [chargingStations.id],
  }),
}));

// ============================================================================
// MAINTENANCE FUND - Fondo de mantenimiento para estaciones colectivas
// ============================================================================

export const maintenanceFundTypeEnum = mysqlEnum("maintenance_fund_type", ["deposit", "withdrawal"]);

export const maintenanceFundRecords = mysqlTable("maintenance_fund_records", {
  id: int("id").autoincrement().primaryKey(),
  stationId: int("stationId").notNull(), // FK a charging_stations
  
  // Tipo: deposit (aporte mensual del waterfall) o withdrawal (cobro por mantenimiento)
  type: maintenanceFundTypeEnum.notNull(),
  
  // Monto en COP
  amount: bigint("amount", { mode: "number" }).notNull(),
  
  // Descripción del movimiento
  description: text("description").notNull(),
  
  // Para withdrawals: detalle del mantenimiento realizado
  maintenanceType: varchar("maintenanceType", { length: 100 }), // "preventivo" | "correctivo"
  maintenanceDetail: text("maintenanceDetail"), // Descripción detallada del trabajo
  technicianName: varchar("technicianName", { length: 255 }), // Nombre del técnico
  invoiceNumber: varchar("invoiceNumber", { length: 100 }), // Número de factura/recibo
  
  // Referencia a liquidación (para deposits)
  settlementId: int("settlementId"), // FK a financial_settlements
  
  // Balance acumulado después de este movimiento
  balanceAfter: bigint("balanceAfter", { mode: "number" }).notNull().default(0),
  
  // Auditoría
  createdBy: int("createdBy"), // FK a users (admin que registró)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MaintenanceFundRecord = typeof maintenanceFundRecords.$inferSelect;
export type InsertMaintenanceFundRecord = typeof maintenanceFundRecords.$inferInsert;

export const maintenanceFundRecordsRelations = relations(maintenanceFundRecords, ({ one }) => ({
  station: one(chargingStations, {
    fields: [maintenanceFundRecords.stationId],
    references: [chargingStations.id],
  }),
  settlement: one(financialSettlements, {
    fields: [maintenanceFundRecords.settlementId],
    references: [financialSettlements.id],
  }),
  creator: one(users, {
    fields: [maintenanceFundRecords.createdBy],
    references: [users.id],
  }),
}));

// ============================================================================
// SCHEDULED MAINTENANCES - Mantenimientos preventivos programados
// ============================================================================

export const maintenanceFrequencyEnum = mysqlEnum("maintenance_frequency", [
  "weekly", "biweekly", "monthly", "quarterly", "semiannual", "annual", "one_time"
]);

export const maintenanceScheduleStatusEnum = mysqlEnum("maintenance_schedule_status", [
  "active", "paused", "completed", "cancelled"
]);

export const maintenanceTaskStatusEnum = mysqlEnum("maintenance_task_status", [
  "pending", "in_progress", "completed", "overdue", "cancelled"
]);

export const scheduledMaintenances = mysqlTable("scheduled_maintenances", {
  id: int("id").autoincrement().primaryKey(),
  stationId: int("stationId").notNull(), // FK a charging_stations
  
  // Información del mantenimiento
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  maintenanceType: varchar("maintenanceType", { length: 100 }).notNull(), // "preventivo" | "inspección" | "limpieza" | "calibración" | "actualización_firmware"
  
  // Programación
  frequency: maintenanceFrequencyEnum.notNull(),
  nextDueDate: timestamp("nextDueDate").notNull(), // Próxima fecha programada
  lastCompletedDate: timestamp("lastCompletedDate"), // Última vez que se completó
  
  // Horario de trabajo (8:00 - 17:00 por defecto)
  preferredTimeStart: varchar("preferredTimeStart", { length: 5 }).default("08:00").notNull(),
  preferredTimeEnd: varchar("preferredTimeEnd", { length: 5 }).default("17:00").notNull(),
  
  // Asignación
  assignedTechnicianId: int("assignedTechnicianId"), // FK a users (técnico asignado)
  assignedEngineerId: int("assignedEngineerId"), // FK a users (jefe de área/ingeniero responsable)
  
  // Costo estimado (para presupuesto del fondo de mantenimiento)
  estimatedCostCop: bigint("estimatedCostCop", { mode: "number" }).default(0),
  
  // Recordatorios
  reminderDaysBefore: int("reminderDaysBefore").default(3).notNull(), // Días antes para enviar recordatorio
  reminderSent: boolean("reminderSent").default(false).notNull(), // Si ya se envió el recordatorio
  
  // Estado del programa
  status: maintenanceScheduleStatusEnum.default("active").notNull(),
  
  // Notas
  notes: text("notes"),
  
  // Auditoría
  createdBy: int("createdBy").notNull(), // FK a users
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ScheduledMaintenance = typeof scheduledMaintenances.$inferSelect;
export type InsertScheduledMaintenance = typeof scheduledMaintenances.$inferInsert;

// ============================================================================
// MAINTENANCE TASKS - Tareas individuales generadas por los programas
// ============================================================================

export const maintenanceTasks = mysqlTable("maintenance_tasks", {
  id: int("id").autoincrement().primaryKey(),
  scheduleId: int("scheduleId").notNull(), // FK a scheduled_maintenances
  stationId: int("stationId").notNull(), // FK a charging_stations
  
  // Información de la tarea
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  maintenanceType: varchar("maintenanceType", { length: 100 }).notNull(),
  
  // Fechas
  dueDate: timestamp("dueDate").notNull(), // Fecha límite
  scheduledDate: timestamp("scheduledDate"), // Fecha programada real
  completedDate: timestamp("completedDate"), // Fecha de completación
  
  // Asignación
  assignedTechnicianId: int("assignedTechnicianId"), // FK a users
  
  // Resultado
  status: maintenanceTaskStatusEnum.default("pending").notNull(),
  completionNotes: text("completionNotes"),
  actualCostCop: bigint("actualCostCop", { mode: "number" }).default(0),
  
  // Referencia al fondo de mantenimiento (si se cobró)
  fundRecordId: int("fundRecordId"), // FK a maintenance_fund_records
  
  // Calificación del trabajo (1-5 estrellas)
  qualityRating: int("qualityRating"), // 1-5
  ratingNotes: text("ratingNotes"),
  ratedBy: int("ratedBy"), // FK a users (quien calificó)
  
  // Auditoría
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MaintenanceTask = typeof maintenanceTasks.$inferSelect;
export type InsertMaintenanceTask = typeof maintenanceTasks.$inferInsert;

// Relations
export const scheduledMaintenancesRelations = relations(scheduledMaintenances, ({ one, many }) => ({
  station: one(chargingStations, {
    fields: [scheduledMaintenances.stationId],
    references: [chargingStations.id],
  }),
  assignedTechnician: one(users, {
    fields: [scheduledMaintenances.assignedTechnicianId],
    references: [users.id],
  }),
  tasks: many(maintenanceTasks),
  creator: one(users, {
    fields: [scheduledMaintenances.createdBy],
    references: [users.id],
  }),
}));

export const maintenanceTasksRelations = relations(maintenanceTasks, ({ one }) => ({
  schedule: one(scheduledMaintenances, {
    fields: [maintenanceTasks.scheduleId],
    references: [scheduledMaintenances.id],
  }),
  station: one(chargingStations, {
    fields: [maintenanceTasks.stationId],
    references: [chargingStations.id],
  }),
  assignedTechnician: one(users, {
    fields: [maintenanceTasks.assignedTechnicianId],
    references: [users.id],
  }),
  fundRecord: one(maintenanceFundRecords, {
    fields: [maintenanceTasks.fundRecordId],
    references: [maintenanceFundRecords.id],
  }),
  rater: one(users, {
    fields: [maintenanceTasks.ratedBy],
    references: [users.id],
  }),
}));


// ============================================================================
// BACKUP SYSTEM
// ============================================================================

export const backupStatusEnum = mysqlEnum("backup_status", ["RUNNING", "COMPLETED", "FAILED", "PARTIAL"]);
export const backupTypeEnum = mysqlEnum("backup_type", ["FULL", "CRITICAL", "FINANCIAL", "USERS", "MANUAL"]);

export const backupLogs = mysqlTable("backup_logs", {
  id: int("id").autoincrement().primaryKey(),
  backupType: backupTypeEnum.notNull(),
  status: backupStatusEnum.notNull().default("RUNNING"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  // Metadata
  tablesIncluded: json("tablesIncluded").$type<string[]>(),
  totalRows: int("totalRows").default(0),
  totalSizeBytes: bigint("totalSizeBytes", { mode: "number" }).default(0),
  s3Url: text("s3Url"),
  s3Key: varchar("s3Key", { length: 500 }),
  // Error tracking
  errorMessage: text("errorMessage"),
  errorDetails: json("errorDetails").$type<Record<string, string>>(),
  // Who triggered it
  triggeredBy: varchar("triggeredBy", { length: 100 }).default("system"), // 'system', 'admin', userId
  isAutomatic: boolean("isAutomatic").default(true).notNull(),
  // Retention
  expiresAt: timestamp("expiresAt"),
  isDeleted: boolean("isDeleted").default(false).notNull(),
  // Notes
  notes: text("notes"),
});


// ============================================================================
// API KEYS & WEBHOOKS (Integración externa)
// ============================================================================

export const apiKeys = mysqlTable("api_keys", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 100 }).notNull(), // Nombre descriptivo de la key
  keyHash: varchar("keyHash", { length: 64 }).notNull().unique(), // SHA-256 hash
  keyPrefix: varchar("keyPrefix", { length: 12 }).notNull(), // Primeros 8 chars para identificación
  permissions: json("permissions").$type<string[]>(), // ["stations:read", "transactions:read", etc.]
  isActive: boolean("isActive").default(true).notNull(),
  expiresAt: timestamp("expiresAt"),
  lastUsedAt: timestamp("lastUsedAt"),
  usageCount: int("usageCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const apiWebhooks = mysqlTable("api_webhooks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  url: varchar("url", { length: 500 }).notNull(),
  events: json("events").$type<string[]>().notNull(), // ["charging.started", "charging.completed", etc.]
  secret: varchar("secret", { length: 64 }), // Para verificación HMAC
  isActive: boolean("isActive").default(true).notNull(),
  lastTriggeredAt: timestamp("lastTriggeredAt"),
  failCount: int("failCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});


// ============================================================================
// REFUNDS TABLE (Historial de reembolsos para auditoría)
// ============================================================================
export const refunds = mysqlTable("refunds", {
  id: int("id").autoincrement().primaryKey(),
  transactionId: int("transactionId").notNull(), // FK a transactions
  userId: int("userId").notNull(), // Usuario que recibe el reembolso
  adminId: int("adminId").notNull(), // Admin que ejecutó el reembolso
  adminName: varchar("adminName", { length: 255 }).notNull(), // Nombre del admin (para auditoría)
  // Montos
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(), // Monto reembolsado
  // Tipo de reembolso
  refundType: varchar("refundType", { length: 50 }).notNull(), // "general", "overstay", "energy"
  // Motivo y detalles
  reason: text("reason").notNull(), // Motivo del reembolso
  // Referencia al reclamo (si aplica)
  claimId: int("claimId"), // FK a claims (opcional)
  // Wallet transaction generada
  walletTransactionId: int("walletTransactionId"), // FK a wallet_transactions
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Refund = typeof refunds.$inferSelect;
export type InsertRefund = typeof refunds.$inferInsert;

// ============================================================================
// CLAIMS TABLE (Reclamos de cobro incorrecto)
// ============================================================================
export const claims = mysqlTable("claims", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // Usuario que reclama
  userName: varchar("userName", { length: 255 }).notNull(), // Nombre del usuario
  transactionId: int("transactionId").notNull(), // Transacción reclamada
  // Detalle del reclamo
  category: varchar("category", { length: 50 }).notNull(), // "overcharge", "overstay_unfair", "wrong_kwh", "double_charge", "other"
  description: text("description").notNull(), // Descripción del problema
  requestedAmount: decimal("requestedAmount", { precision: 12, scale: 2 }), // Monto que solicita (opcional)
  // Estado del reclamo
  status: varchar("status", { length: 30 }).default("PENDING").notNull(), // PENDING, IN_REVIEW, RESOLVED, REJECTED
  // Resolución
  resolvedByAdminId: int("resolvedByAdminId"), // Admin que resolvió
  resolvedByAdminName: varchar("resolvedByAdminName", { length: 255 }),
  resolution: text("resolution"), // Nota de resolución
  refundId: int("refundId"), // FK a refunds (si se reembolsó)
  resolvedAt: timestamp("resolvedAt"),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Claim = typeof claims.$inferSelect;
export type InsertClaim = typeof claims.$inferInsert;

// ============================================================================
// OVERSTAY LOCKS TABLE - Prevents duplicate overstay charges across instances
// ============================================================================

export const overstayLocks = mysqlTable("overstay_locks", {
  id: int("id").autoincrement().primaryKey(),
  /** EVSE being monitored */
  evseId: int("evseId").notNull(),
  /** Transaction being charged for overstay */
  transactionId: int("transactionId").notNull(),
  /** Instance ID that holds the lock */
  instanceId: varchar("instanceId", { length: 100 }).notNull(),
  /** Last heartbeat from the instance holding the lock */
  lastHeartbeat: timestamp("lastHeartbeat").notNull(),
  /** Accumulated overstay cost so far (for recovery after restart) */
  accumulatedCost: decimal("accumulatedCost", { precision: 12, scale: 2 }).default("0"),
  /** Last time a charge was applied */
  lastChargeTime: timestamp("lastChargeTime").notNull(),
  /** When the overstay tracking started (finishingStartTime) */
  startedAt: timestamp("startedAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OverstayLock = typeof overstayLocks.$inferSelect;

// ============================================================
// PENDING CHARGE SESSIONS - Persistencia de sesiones pendientes
// Resuelve el problema de múltiples instancias del servidor
// donde la sesión se crea en memoria de una instancia pero
// el StartTransaction llega a otra instancia diferente
// ============================================================
export const pendingChargeSessions = mysqlTable("pending_charge_sessions", {
  id: int("id").primaryKey().autoincrement(),
  sessionId: varchar("sessionId", { length: 64 }).notNull().unique(),
  userId: int("userId").notNull(),
  stationId: int("stationId").notNull(),
  connectorId: int("connectorId").notNull(),
  ocppIdentity: varchar("ocppIdentity", { length: 128 }).notNull(),
  chargeMode: varchar("chargeMode", { length: 20 }).notNull().default("full_charge"),
  targetValue: decimal("targetValue", { precision: 12, scale: 2 }).notNull().default("0"),
  estimatedCost: decimal("estimatedCost", { precision: 12, scale: 2 }).notNull().default("0"),
  pricePerKwh: decimal("pricePerKwh", { precision: 10, scale: 2 }).notNull().default("1800"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  consumed: boolean("consumed").notNull().default(false),
});

export type PendingChargeSession = typeof pendingChargeSessions.$inferSelect;


// ============================================================================
// QUOTES MODULE - Cotizaciones Automatizadas de Cargadores
// ============================================================================

export const quoteStatusEnum = mysqlEnum("quote_status", [
  "DRAFT",      // Borrador
  "SENT",       // Enviada al cliente
  "VIEWED",     // El cliente abrió el link
  "ACCEPTED",   // Aceptada por el cliente
  "REJECTED",   // Rechazada
  "EXPIRED",    // Vencida (pasaron los días de vigencia)
]);

/** Catálogo de cargadores disponibles para venta (configurado por admin) */
export const chargersCatalog = mysqlTable("chargers_catalog", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(), // Ej: "Cargador DC 120 kW CCS2"
  slug: varchar("slug", { length: 100 }).notNull().unique(), // Ej: "dc-120kw"
  powerKw: decimal("powerKw", { precision: 8, scale: 2 }).notNull(), // Potencia en kW
  chargeType: chargeTypeEnum.notNull(), // AC o DC
  connectorType: varchar("connectorType", { length: 50 }).notNull(), // CCS2, Type2, etc.
  price: bigint("price", { mode: "number" }).notNull(), // Precio en COP (incluye llave en mano)
  description: text("description"), // Descripción técnica corta
  features: json("features").$type<string[]>(), // Lista de características incluidas
  imageUrl: text("imageUrl"), // Foto del cargador
  includesTransformer: boolean("includesTransformer").default(false), // Si incluye transformador
  cableMetersIncluded: int("cableMetersIncluded").default(10), // Metros de cableado incluidos
  warrantyYears: int("warrantyYears").default(2), // Años de garantía
  commissionPercent: decimal("commissionPercent", { precision: 5, scale: 2 }).default("0.00").notNull(), // % comisión comercial
  isActive: boolean("isActive").default(true).notNull(),
  sortOrder: int("sortOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ChargerCatalog = typeof chargersCatalog.$inferSelect;
export type InsertChargerCatalog = typeof chargersCatalog.$inferInsert;

/** Configuración global de cotizaciones (singleton, 1 fila) */
export const quoteSettings = mysqlTable("quote_settings", {
  id: int("id").autoincrement().primaryKey(),
  validityDays: int("validityDays").default(30).notNull(), // Días de vigencia
  evgreenFeePercent: int("evgreenFeePercent").default(30).notNull(), // % fee de EVGreen (30%)
  ownerSharePercent: int("ownerSharePercent").default(70).notNull(), // % para el dueño (70%)
  hostSharePercent: int("hostSharePercent").default(0).notNull(), // % Aliado Comercial (sobre margen bruto)
  // Parámetros por defecto de proyección
  defaultEnergyCostPerKwh: int("defaultEnergyCostPerKwh").default(700).notNull(), // COP/kWh costo energía
  defaultSalePricePerKwh: int("defaultSalePricePerKwh").default(1800).notNull(), // COP/kWh precio venta
  defaultDailyHours: decimal("defaultDailyHours", { precision: 4, scale: 1 }).default("4.0").notNull(), // Horas uso diario
  companyName: varchar("companyName", { length: 255 }).default("EVGreen - Green House Project S.A.S").notNull(),
  companyNit: varchar("companyNit", { length: 50 }).default("901.447.678-0").notNull(),
  companyPhone: varchar("companyPhone", { length: 50 }).default("321 456 7644").notNull(),
  companyEmail: varchar("companyEmail", { length: 255 }).default("evgreen@greenhproject.com").notNull(),
  companyWebsite: varchar("companyWebsite", { length: 255 }).default("www.evgreen.lat").notNull(),
  // Textos configurables de la cotización
  headerMessage: text("headerMessage"), // Mensaje de cabecera personalizable
  footerMessage: text("footerMessage"), // Notas al pie
  termsAndConditions: text("termsAndConditions"), // Términos y condiciones
  exclusions: text("exclusions"), // Qué NO incluye
  // Beneficios del modelo EVGreen (justificación del 30%)
  benefitsDescription: text("benefitsDescription"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type QuoteSettings = typeof quoteSettings.$inferSelect;

/** Cotizaciones generadas */
export const quotes = mysqlTable("quotes", {
  id: int("id").autoincrement().primaryKey(),
  quoteNumber: varchar("quoteNumber", { length: 20 }).notNull().unique(), // EVG-2026-0001
  // Datos del cliente
  clientName: varchar("clientName", { length: 255 }).notNull(),
  clientEmail: varchar("clientEmail", { length: 320 }).notNull(),
  clientPhone: varchar("clientPhone", { length: 50 }),
  clientCompany: varchar("clientCompany", { length: 255 }),
  clientCity: varchar("clientCity", { length: 100 }),
  // Asesor que creó la cotización
  advisorId: int("advisorId").notNull(), // FK a users
  advisorName: varchar("advisorName", { length: 255 }),
  // Estado y seguimiento
  status: quoteStatusEnum.default("DRAFT").notNull(),
  // Totales
  subtotal: bigint("subtotal", { mode: "number" }).notNull().default(0), // Suma de items
  discount: bigint("discount", { mode: "number" }).default(0), // Descuento aplicado
  total: bigint("total", { mode: "number" }).notNull().default(0), // Total final
  totalCommission: bigint("totalCommission", { mode: "number" }).default(0), // Comisión total del comercial
  // Vigencia
  validityDays: int("validityDays").default(30).notNull(),
  expiresAt: timestamp("expiresAt"),
  // Notas del asesor
  internalNotes: text("internalNotes"), // Solo visible para el equipo
  clientNotes: text("clientNotes"), // Notas visibles para el cliente
  // Token único para acceso público (link de visualización)
  publicToken: varchar("publicToken", { length: 64 }).notNull().unique(),
  // Tracking
  viewedAt: timestamp("viewedAt"), // Cuándo el cliente abrió el link
  viewCount: int("viewCount").default(0),
  sentAt: timestamp("sentAt"), // Cuándo se envió por email
  acceptedAt: timestamp("acceptedAt"),
  rejectedAt: timestamp("rejectedAt"),
  // PDF generado
  pdfUrl: text("pdfUrl"), // URL del PDF en S3
  // === Modelo Financiero Personalizado por Cotización ===
  evgreenSharePercent: decimal("evgreenSharePercent", { precision: 5, scale: 2 }).default("30.00"), // % EVGreen (Gestor)
  investorSharePercent: decimal("investorSharePercent", { precision: 5, scale: 2 }).default("70.00"), // % Inversionista
  hostSharePercent: decimal("hostSharePercent", { precision: 5, scale: 2 }).default("0.00"), // % Aliado Comercial (sobre margen bruto)
  // === Parámetros de Proyección de Ingresos ===
  projectionEnergyCostPerKwh: int("projectionEnergyCostPerKwh").default(700), // COP/kWh costo energía
  projectionSalePricePerKwh: int("projectionSalePricePerKwh").default(1800), // COP/kWh precio venta
  projectionDailyHours: decimal("projectionDailyHours", { precision: 4, scale: 1 }).default("4.0"), // Horas de uso diario
  projectionScenario: varchar("projectionScenario", { length: 20 }).default("realistic"), // pessimistic, realistic, optimistic
  showProjection: boolean("showProjection").default(true), // Mostrar proyección en la cotización
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Quote = typeof quotes.$inferSelect;
export type InsertQuote = typeof quotes.$inferInsert;

/** Items de cada cotización (cargadores seleccionados) */
export const quoteItems = mysqlTable("quote_items", {
  id: int("id").autoincrement().primaryKey(),
  quoteId: int("quoteId").notNull(), // FK a quotes
  catalogItemId: int("catalogItemId").notNull(), // FK a chargers_catalog
  // Snapshot del producto al momento de cotizar (para que no cambie si se edita el catálogo)
  productName: varchar("productName", { length: 255 }).notNull(),
  productPowerKw: decimal("productPowerKw", { precision: 8, scale: 2 }).notNull(),
  productChargeType: varchar("productChargeType", { length: 10 }).notNull(), // AC o DC
  productConnector: varchar("productConnector", { length: 50 }).notNull(),
  unitPrice: bigint("unitPrice", { mode: "number" }).notNull(), // Precio unitario COP
  quantity: int("quantity").notNull().default(1),
  lineTotal: bigint("lineTotal", { mode: "number" }).notNull(), // unitPrice * quantity
  includesTransformer: boolean("includesTransformer").default(false),
  cableMetersIncluded: int("cableMetersIncluded").default(10),
  productImageUrl: text("productImageUrl"), // Snapshot de la imagen del cargador
  commissionPercent: decimal("commissionPercent", { precision: 5, scale: 2 }).default("0.00").notNull(), // Snapshot comisión %
  commissionAmount: bigint("commissionAmount", { mode: "number" }).default(0).notNull(), // Monto comisión calculado
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type QuoteItem = typeof quoteItems.$inferSelect;
export type InsertQuoteItem = typeof quoteItems.$inferInsert;


// ============================================================================
// SPACE SUBMISSIONS - Postulaciones de espacios para cargadores
// ============================================================================

export const spaceSubmissions = mysqlTable("space_submissions", {
  id: int("id").autoincrement().primaryKey(),
  
  // Código único de postulación (SPE-2026-XXXX)
  code: varchar("code", { length: 20 }).notNull().unique(),
  
  // Datos del postulante
  submitterName: varchar("submitterName", { length: 255 }).notNull(),
  submitterEmail: varchar("submitterEmail", { length: 320 }).notNull(),
  submitterPhone: varchar("submitterPhone", { length: 20 }).notNull(),
  submitterCompany: varchar("submitterCompany", { length: 255 }),
  submitterDocument: varchar("submitterDocument", { length: 50 }), // CC o NIT
  
  // Datos del espacio
  spaceName: varchar("spaceName", { length: 255 }).notNull(), // Nombre del lugar
  spaceType: spaceTypeEnum.notNull(),
  spaceTypeOther: varchar("spaceTypeOther", { length: 255 }), // Si es "other"
  address: varchar("address", { length: 500 }).notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  department: varchar("department", { length: 100 }),
  country: varchar("country", { length: 100 }).default("Colombia").notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  
  // Características del espacio
  availableAreaM2: decimal("availableAreaM2", { precision: 10, scale: 2 }), // Área disponible en m²
  parkingSpots: int("parkingSpots"), // Número de puestos de parqueo disponibles
  transformerCapacityKva: decimal("transformerCapacityKva", { precision: 10, scale: 2 }), // Capacidad del transformador en kVA
  hasElectricalPanel: boolean("hasElectricalPanel").default(false), // ¿Tiene tablero eléctrico accesible?
  electricalDistance: int("electricalDistance"), // Distancia del tablero al punto de carga (metros)
  hasInternet: boolean("hasInternet").default(false), // ¿Tiene conexión a internet?
  operatingHoursStart: varchar("operatingHoursStart", { length: 5 }).default("06:00"), // Horario de operación
  operatingHoursEnd: varchar("operatingHoursEnd", { length: 5 }).default("22:00"),
  is24Hours: boolean("is24Hours").default(false),
  
  // Información de tráfico y contexto
  estimatedDailyVehicles: int("estimatedDailyVehicles"), // Vehículos diarios estimados
  estimatedEvPercent: int("estimatedEvPercent"), // % estimado de vehículos eléctricos
  nearbyAttractions: text("nearbyAttractions"), // Puntos de interés cercanos
  socioeconomicStratum: int("socioeconomicStratum"), // Estrato socioeconómico (1-6 en Colombia)
  
  // Notas adicionales del postulante
  additionalNotes: text("additionalNotes"),
  
  // Estado del proceso
  status: spaceSubmissionStatusEnum.default("pending").notNull(),
  
  // Evaluación técnica (llenada por el admin)
  technicalScore: int("technicalScore"), // Puntaje técnico 1-100
  technicalNotes: text("technicalNotes"), // Notas de la evaluación
  electricalViability: mysqlEnum("electrical_viability", ["viable", "requires_upgrade", "not_viable"]),
  accessibilityScore: int("accessibilityScore"), // Puntaje de accesibilidad 1-10
  trafficPotentialScore: int("trafficPotentialScore"), // Potencial de tráfico 1-10
  evaluatedBy: int("evaluatedBy"), // FK a users (admin que evaluó)
  evaluatedAt: timestamp("evaluatedAt"),
  rejectionReason: text("rejectionReason"), // Motivo de rechazo (si aplica)
  
  // Calificación IA (generada automáticamente)
  aiScore: int("aiScore"), // Puntaje IA 1-100
  aiAnalysis: text("aiAnalysis"), // Análisis detallado de la IA (JSON o texto)
  aiScoredAt: timestamp("aiScoredAt"),
  
  // Carta de intención
  letterSentAt: timestamp("letterSentAt"),
  letterAcceptedAt: timestamp("letterAcceptedAt"),
  letterToken: varchar("letterToken", { length: 100 }), // Token único para aceptar la carta
  letterSignerName: varchar("letterSignerName", { length: 255 }), // Nombre de quien firma
  letterSignerDocument: varchar("letterSignerDocument", { length: 50 }), // Documento de quien firma
  letterSignerIp: varchar("letterSignerIp", { length: 50 }), // IP desde donde se firmó
  signedLetterPdfUrl: text("signedLetterPdfUrl"), // URL del PDF firmado en S3
  signedLetterPdfKey: varchar("signedLetterPdfKey", { length: 500 }), // Key del PDF en S3
  letterSignerUserAgent: text("letterSignerUserAgent"), // User-Agent del navegador del firmante
  
  // Conexión con crowdfunding (cuando se publica)
  crowdfundingProjectId: int("crowdfundingProjectId"), // FK a crowdfunding_projects
  
  // Datos de inversión estimados (para publicar en crowdfunding)
  estimatedInvestmentCop: bigint("estimatedInvestmentCop", { mode: "number" }), // Inversión total estimada
  estimatedPowerKw: int("estimatedPowerKw"), // Potencia estimada a instalar
  estimatedChargerCount: int("estimatedChargerCount"), // Número de cargadores estimados
  recommendedChargerType: varchar("recommendedChargerType", { length: 50 }), // AC/DC recomendado
  
  // Tipo de inversión (clasificación en mapa de inversionistas)
  investmentType: mysqlEnum("investment_type", ["individual", "colectiva"]).default("individual").notNull(),
  
  // Contador de visitas de inversionistas
  viewCount: int("viewCount").default(0).notNull(),
  
  // Auditoría
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SpaceSubmission = typeof spaceSubmissions.$inferSelect;
export type InsertSpaceSubmission = typeof spaceSubmissions.$inferInsert;

// ============================================================================
// SPACE PHOTOS - Fotos de evidencia de los espacios postulados
// ============================================================================

export const spacePhotos = mysqlTable("space_photos", {
  id: int("id").autoincrement().primaryKey(),
  submissionId: int("submissionId").notNull(), // FK a space_submissions
  
  photoUrl: text("photoUrl").notNull(), // URL en S3
  photoKey: varchar("photoKey", { length: 500 }).notNull(), // Key en S3
  caption: varchar("caption", { length: 255 }), // Descripción de la foto
  photoType: mysqlEnum("photo_type", [
    "general",          // Vista general del espacio
    "electrical_panel", // Tablero eléctrico
    "transformer",      // Transformador
    "parking_area",     // Área de parqueo
    "access_road",      // Vía de acceso
    "surroundings",     // Alrededores
    "other",            // Otra
  ]).default("general").notNull(),
  
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SpacePhoto = typeof spacePhotos.$inferSelect;
export type InsertSpacePhoto = typeof spacePhotos.$inferInsert;

// ============================================================================
// SPACE SUBMISSIONS RELATIONS
// ============================================================================

export const spaceSubmissionsRelations = relations(spaceSubmissions, ({ one, many }) => ({
  photos: many(spacePhotos),
  evaluator: one(users, {
    fields: [spaceSubmissions.evaluatedBy],
    references: [users.id],
  }),
  crowdfundingProject: one(crowdfundingProjects, {
    fields: [spaceSubmissions.crowdfundingProjectId],
    references: [crowdfundingProjects.id],
  }),
}));

export const spacePhotosRelations = relations(spacePhotos, ({ one }) => ({
  submission: one(spaceSubmissions, {
    fields: [spacePhotos.submissionId],
    references: [spaceSubmissions.id],
  }),
}));

// ============================================================================
// INVESTOR LEADS - Leads de inversionistas interesados en espacios
// ============================================================================

export const investorLeads = mysqlTable("investor_leads", {
  id: int("id").autoincrement().primaryKey(),
  spaceId: int("spaceId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  interestedAmount: bigint("interestedAmount", { mode: "number" }),
  message: text("message"),
  status: mysqlEnum("lead_status", ["new", "contacted", "converted", "discarded"]).default("new").notNull(),
  adminNotes: text("adminNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type InvestorLead = typeof investorLeads.$inferSelect;
export type InsertInvestorLead = typeof investorLeads.$inferInsert;

export const investorLeadsRelations = relations(investorLeads, ({ one }) => ({
  space: one(spaceSubmissions, {
    fields: [investorLeads.spaceId],
    references: [spaceSubmissions.id],
  }),
}));


// ============================================================================
// LOCAL AUTHORIZATION LIST - Gestión de listas locales RFID para modo offline
// ============================================================================
// Permite que los cargadores operen en modo offline usando tarjetas RFID
// pre-autorizadas almacenadas localmente en el firmware del cargador.

export const localAuthListStatusEnum = mysqlEnum("local_auth_list_status", [
  "SYNCED",      // Lista sincronizada con el cargador
  "PENDING",     // Pendiente de enviar al cargador
  "FAILED",      // Falló el envío al cargador
  "OUTDATED",    // Lista desactualizada (se agregaron/removieron tarjetas)
]);

export const localAuthLists = mysqlTable("local_auth_lists", {
  id: int("id").autoincrement().primaryKey(),
  stationId: int("stationId").notNull(), // FK a charging_stations
  // Versión actual de la lista local (incrementa con cada actualización)
  listVersion: int("listVersion").default(0).notNull(),
  // Versión confirmada por el cargador (GetLocalListVersion response)
  chargerListVersion: int("chargerListVersion").default(0),
  // Estado de sincronización
  status: localAuthListStatusEnum.default("PENDING").notNull(),
  // Última vez que se envió la lista al cargador
  lastSyncAt: timestamp("lastSyncAt"),
  // Última respuesta del cargador al SendLocalList
  lastSyncResult: varchar("lastSyncResult", { length: 50 }), // Accepted, Failed, VersionMismatch, NotSupported
  // Configuración de comportamiento offline
  offlinePolicy: mysqlEnum("offline_policy", [
    "LOCAL_LIST_ONLY",  // Solo acepta tags de la lista local
    "FREE_VENDING",     // Acepta cualquier tag (modo libre)
    "REJECT_ALL",       // Rechaza todo si no hay conexión
  ]).default("LOCAL_LIST_ONLY").notNull(),
  // Número de entradas en la lista
  entryCount: int("entryCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LocalAuthList = typeof localAuthLists.$inferSelect;
export type InsertLocalAuthList = typeof localAuthLists.$inferInsert;

export const localAuthEntries = mysqlTable("local_auth_entries", {
  id: int("id").autoincrement().primaryKey(),
  listId: int("listId").notNull(), // FK a local_auth_lists
  stationId: int("stationId").notNull(), // FK a charging_stations (denormalizado)
  // El idTag que se envía al cargador
  idTag: varchar("idTag", { length: 50 }).notNull(),
  // Referencia al idTag en la tabla principal (puede ser null para tags maestros sin usuario)
  idTagRefId: int("idTagRefId"), // FK a id_tags
  // Estado de autorización en la lista local
  authStatus: mysqlEnum("auth_status", ["Accepted", "Blocked", "Expired", "ConcurrentTx"]).default("Accepted").notNull(),
  // Fecha de expiración en la lista local del cargador
  expiryDate: timestamp("expiryDate"),
  // Es tarjeta maestra del dueño de la estación
  isMasterCard: boolean("isMasterCard").default(false).notNull(),
  // Etiqueta descriptiva
  label: varchar("label", { length: 100 }),
  // Auditoría
  addedBy: int("addedBy"), // userId del admin que la agregó
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LocalAuthEntry = typeof localAuthEntries.$inferSelect;
export type InsertLocalAuthEntry = typeof localAuthEntries.$inferInsert;

// Tabla para registrar transacciones offline pendientes de sincronización
export const offlineTransactions = mysqlTable("offline_transactions", {
  id: int("id").autoincrement().primaryKey(),
  stationId: int("stationId").notNull(), // FK a charging_stations
  // Datos de la transacción como la reportó el cargador al reconectarse
  ocppTransactionId: varchar("ocppTransactionId", { length: 100 }),
  idTag: varchar("idTag", { length: 50 }),
  connectorId: int("connectorId"),
  meterStart: decimal("meterStart", { precision: 12, scale: 4 }),
  meterEnd: decimal("meterEnd", { precision: 12, scale: 4 }),
  startTimestamp: timestamp("startTimestamp"),
  endTimestamp: timestamp("endTimestamp"),
  // Estado de reconciliación
  reconciled: boolean("reconciled").default(false).notNull(),
  reconciledAt: timestamp("reconciledAt"),
  reconciledTransactionId: int("reconciledTransactionId"), // FK a transactions (si se logró asociar)
  // Notas de reconciliación
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OfflineTransaction = typeof offlineTransactions.$inferSelect;
export type InsertOfflineTransaction = typeof offlineTransactions.$inferInsert;

// Relations
export const localAuthListsRelations = relations(localAuthLists, ({ one, many }) => ({
  station: one(chargingStations, {
    fields: [localAuthLists.stationId],
    references: [chargingStations.id],
  }),
  entries: many(localAuthEntries),
}));

export const localAuthEntriesRelations = relations(localAuthEntries, ({ one }) => ({
  list: one(localAuthLists, {
    fields: [localAuthEntries.listId],
    references: [localAuthLists.id],
  }),
  station: one(chargingStations, {
    fields: [localAuthEntries.stationId],
    references: [chargingStations.id],
  }),
}));

export const offlineTransactionsRelations = relations(offlineTransactions, ({ one }) => ({
  station: one(chargingStations, {
    fields: [offlineTransactions.stationId],
    references: [chargingStations.id],
  }),
}));


// ============================================================================
// PARTNER APPLICATIONS
// ============================================================================
export const partnerApplications = mysqlTable("partner_applications", {
  id: int("id").primaryKey().autoincrement(),
  companyName: text("company_name").notNull(),
  contactName: text("contact_name").notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }).notNull(),
  city: varchar("city", { length: 100 }),
  currentBrands: text("current_brands"),
  annualVolume: varchar("annual_volume", { length: 100 }),
  message: text("message"),
  status: mysqlEnum("partner_app_status", ["pending", "contacted", "approved", "rejected"]).default("pending").notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }),
});
export type PartnerApplication = typeof partnerApplications.$inferSelect;
export type InsertPartnerApplication = typeof partnerApplications.$inferInsert;


// ============================================================================
// CONSENTIMIENTO DE TRATAMIENTO DE DATOS (Ley 1581/2012 Colombia)
// ============================================================================

export const consentTypeEnum = mysqlEnum("consent_type", [
  "AI_PROFILING",      // Perfilamiento de hábitos de consumo con IA
  "MARKETING",         // Ofertas y comunicaciones comerciales
  "LOCATION_HISTORY",  // Historial de ubicaciones de carga
]);

export const userDataConsents = mysqlTable("user_data_consents", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // FK a users

  consentType: consentTypeEnum.notNull(),

  // Estado actual
  granted: boolean("granted").notNull(),

  // Auditoría legal: QUÉ versión del texto aceptó, CUÁNDO y DESDE DÓNDE.
  policyVersion: varchar("policyVersion", { length: 20 }).notNull(), // ej: "2026-06-v1"
  grantedAt: timestamp("grantedAt"),
  revokedAt: timestamp("revokedAt"),
  ipAddress: varchar("ipAddress", { length: 45 }),   // IPv4/IPv6
  userAgent: varchar("userAgent", { length: 512 }),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserDataConsent = typeof userDataConsents.$inferSelect;
export type InsertUserDataConsent = typeof userDataConsents.$inferInsert;

export const userDataConsentsRelations = relations(userDataConsents, ({ one }) => ({
  user: one(users, {
    fields: [userDataConsents.userId],
    references: [users.id],
  }),
}));

// ============================================================================
// OFERTAS PERSONALIZADAS GENERADAS (auditable)
// ============================================================================

export const offerStatusEnum = mysqlEnum("offer_status", ["ACTIVE", "REDEEMED", "EXPIRED", "DISMISSED"]);

export const personalizedOffers = mysqlTable("personalized_offers", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),

  // Regla determinística que disparó la oferta (auditable — el LLM NO decide
  // descuentos, solo redacta el mensaje)
  triggerRule: varchar("triggerRule", { length: 100 }).notNull(),
  // ej: "OFF_PEAK_SHIFT", "FREQUENT_STATION_REWARD", "WINBACK_14D"

  // Parámetros económicos decididos por la regla (NO por el LLM)
  discountPercent: int("discountPercent"),
  stationId: int("stationId"),
  validFrom: timestamp("validFrom"),
  validUntil: timestamp("validUntil"),

  // Mensaje redactado por el LLM a partir del perfil
  title: varchar("title", { length: 200 }).notNull(),
  message: text("message").notNull(),

  status: offerStatusEnum.notNull().default("ACTIVE"),
  redeemedAt: timestamp("redeemedAt"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PersonalizedOffer = typeof personalizedOffers.$inferSelect;
export type InsertPersonalizedOffer = typeof personalizedOffers.$inferInsert;

export const personalizedOffersRelations = relations(personalizedOffers, ({ one }) => ({
  user: one(users, {
    fields: [personalizedOffers.userId],
    references: [users.id],
  }),
}));


// ============================================================================
// MULTI-TENANT SaaS MODEL
// ============================================================================

export const orgPlanEnum = mysqlEnum("org_plan", ["starter", "professional", "enterprise"]);
export const orgStatusEnum = mysqlEnum("org_status", ["active", "suspended", "trial", "cancelled"]);

/**
 * organizations - Tabla principal de tenants (clientes SaaS)
 * Cada organización representa un operador de cargadores que licencia la plataforma.
 */
export const organizations = mysqlTable("organizations", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 200 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull(), // subdominio: slug.evgreen.lat
  plan: mysqlEnum("org_plan", ["starter", "professional", "enterprise"]).notNull().default("starter"),
  status: mysqlEnum("org_status", ["active", "suspended", "trial", "cancelled"]).notNull().default("trial"),
  
  // Contacto
  contactName: varchar("contact_name", { length: 200 }),
  contactEmail: varchar("contact_email", { length: 200 }),
  contactPhone: varchar("contact_phone", { length: 50 }),
  nit: varchar("nit", { length: 50 }),
  
  // Branding / White-label
  logoUrl: text("logo_url"),
  primaryColor: varchar("primary_color", { length: 20 }).default("#22c55e"),
  secondaryColor: varchar("secondary_color", { length: 20 }).default("#1e40af"),
  customDomain: varchar("custom_domain", { length: 200 }),
  appName: varchar("app_name", { length: 100 }),
  
  // Red
  networkMember: boolean("network_member").default(true).notNull(),
  
  // Pricing (override por organización — si es null, usa defaults globales)
  setupFeePerCharger: decimal("setup_fee_per_charger", { precision: 10, scale: 2 }),
  annualFeePerCharger: decimal("annual_fee_per_charger", { precision: 10, scale: 2 }),
  transactionFeePercent: decimal("transaction_fee_percent", { precision: 5, scale: 2 }),
  supportFeePercent: decimal("support_fee_percent", { precision: 5, scale: 2 }),
  networkDiscount: decimal("network_discount", { precision: 5, scale: 2 }).default("1.00"),
  minMonthlyFeePerCharger: decimal("min_monthly_fee_per_charger", { precision: 10, scale: 2 }),
  supportIncluded: boolean("support_included").default(false).notNull(),
  
  // Límites
  maxChargers: int("max_chargers").default(10),
  
  // Roaming
  roamingOwnerPercent: decimal("roaming_owner_percent", { precision: 5, scale: 2 }).default("80.00"),
  roamingPlatformPercent: decimal("roaming_platform_percent", { precision: 5, scale: 2 }).default("15.00"),
  roamingReferralPercent: decimal("roaming_referral_percent", { precision: 5, scale: 2 }).default("5.00"),
  
  // Facturación
  billingEmail: varchar("billing_email", { length: 200 }),
  nextBillingDate: timestamp("next_billing_date"),
  trialEndsAt: timestamp("trial_ends_at"),
  
  // Módulos activados (JSON array de keys)
  enabledModules: text("enabled_modules"),
  
  // Soporte configurable
  supportPhone: varchar("support_phone", { length: 50 }),
  supportEmail: varchar("support_email", { length: 200 }),
  supportWhatsapp: varchar("support_whatsapp", { length: 50 }),
  supportMode: varchar("support_mode", { length: 30 }).default("org_only"),
  supportChatEmbed: text("support_chat_embed"),
  
  // Metadata
  notes: text("notes"),
  ownerId: varchar("owner_id", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;

/**
 * platform_pricing_defaults - Valores globales configurables por el superadmin
 * Si una organización no tiene override, se usan estos valores.
 */
export const platformPricingDefaults = mysqlTable("platform_pricing_defaults", {
  id: int("id").primaryKey().autoincrement(),
  plan: mysqlEnum("org_plan", ["starter", "professional", "enterprise"]).notNull(),
  
  setupFeePerCharger: decimal("setup_fee_per_charger", { precision: 10, scale: 2 }).notNull(),
  annualFeePerCharger: decimal("annual_fee_per_charger", { precision: 10, scale: 2 }).notNull(),
  transactionFeePercent: decimal("transaction_fee_percent", { precision: 5, scale: 2 }).notNull(),
  supportFeePercent: decimal("support_fee_percent", { precision: 5, scale: 2 }).notNull(),
  networkDiscount: decimal("network_discount", { precision: 5, scale: 2 }).notNull().default("1.00"),
  minMonthlyFeePerCharger: decimal("min_monthly_fee_per_charger", { precision: 10, scale: 2 }).notNull(),
  maxChargers: int("max_chargers").notNull(),
  
  // Roaming defaults
  roamingOwnerPercent: decimal("roaming_owner_percent", { precision: 5, scale: 2 }).notNull().default("80.00"),
  roamingPlatformPercent: decimal("roaming_platform_percent", { precision: 5, scale: 2 }).notNull().default("15.00"),
  roamingReferralPercent: decimal("roaming_referral_percent", { precision: 5, scale: 2 }).notNull().default("5.00"),
  
  uptimeSla: decimal("uptime_sla", { precision: 5, scale: 2 }).notNull(),
  
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type PlatformPricingDefault = typeof platformPricingDefaults.$inferSelect;
export type InsertPlatformPricingDefault = typeof platformPricingDefaults.$inferInsert;

/**
 * org_billing_records - Registro de cobros realizados a cada organización
 */
export const orgBillingRecords = mysqlTable("org_billing_records", {
  id: int("id").primaryKey().autoincrement(),
  organizationId: int("organization_id").notNull(),
  
  type: mysqlEnum("billing_type", ["setup", "annual_renewal", "transaction_fee", "support_fee", "minimum_fee"]).notNull(),
  description: varchar("description", { length: 500 }),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),
  
  transactionCount: int("transaction_count"),
  totalTransactionVolume: decimal("total_transaction_volume", { precision: 14, scale: 2 }),
  
  status: mysqlEnum("billing_status", ["pending", "paid", "overdue", "cancelled"]).default("pending").notNull(),
  paidAt: timestamp("paid_at"),
  invoiceUrl: text("invoice_url"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type OrgBillingRecord = typeof orgBillingRecords.$inferSelect;
export type InsertOrgBillingRecord = typeof orgBillingRecords.$inferInsert;

// Relations
/**
 * org_users - Usuarios administradores de cada organización SaaS
 * Permite que un usuario sea admin de una org específica
 */
export const orgUsers = mysqlTable("org_users", {
  id: int("id").primaryKey().autoincrement(),
  organizationId: int("organization_id").notNull(), // FK a organizations
  userId: int("user_id").notNull(), // FK a users
  role: mysqlEnum("role", ["admin", "viewer"]).default("admin").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type OrgUser = typeof orgUsers.$inferSelect;
export type InsertOrgUser = typeof orgUsers.$inferInsert;

export const organizationsRelations = relations(organizations, ({ many }) => ({
  billingRecords: many(orgBillingRecords),
}));

export const orgBillingRecordsRelations = relations(orgBillingRecords, ({ one }) => ({
  organization: one(organizations, {
    fields: [orgBillingRecords.organizationId],
    references: [organizations.id],
  }),
}));

// ============================================================================
// OCCUPANCY LIQUIDATIONS TABLE - Liquidaciones de tarifa de ocupación para aliados
// Registra cada cobro de ocupación post-carga con el desglose:
//   - userCharge: lo que pagó el usuario (occupancyRatePerMinute × minutos)
//   - allyTransfer: lo que recibe el aliado (parkingRatePerMinute × minutos)
//   - evgreenMargin: diferencial que retiene EVGreen
// ============================================================================
export const occupancyLiquidations = mysqlTable("occupancy_liquidations", {
  id: int("id").autoincrement().primaryKey(),
  transactionId: int("transactionId").notNull(), // FK a transactions
  stationId: int("stationId").notNull(),         // FK a charging_stations
  hostUserId: int("hostUserId"),                 // FK a users (aliado). null si no hay aliado
  // Minutos cobrados
  minutesCharged: decimal("minutesCharged", { precision: 8, scale: 2 }).notNull(),
  // Tarifas aplicadas (snapshot al momento del cobro)
  occupancyRatePerMinute: int("occupancyRatePerMinute").notNull(), // COP/min cobrado al usuario
  parkingRatePerMinute: int("parkingRatePerMinute").notNull(),     // COP/min transferido al aliado
  // Montos resultantes (COP)
  userCharge: int("userCharge").notNull(),       // Total cobrado al usuario
  allyTransfer: int("allyTransfer").notNull(),   // Total transferido al aliado
  evgreenMargin: int("evgreenMargin").notNull(), // Diferencial para EVGreen
  // Estado del pago al aliado
  allyPaidAt: timestamp("allyPaidAt"),           // null = pendiente de pago al aliado
  // Período de liquidación (para agrupar en reportes mensuales)
  periodYear: int("periodYear").notNull(),       // Año (ej. 2026)
  periodMonth: int("periodMonth").notNull(),     // Mes 1-12
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OccupancyLiquidation = typeof occupancyLiquidations.$inferSelect;
export type InsertOccupancyLiquidation = typeof occupancyLiquidations.$inferInsert;

export const occupancyLiquidationsRelations = relations(occupancyLiquidations, ({ one }) => ({
  transaction: one(transactions, {
    fields: [occupancyLiquidations.transactionId],
    references: [transactions.id],
  }),
  station: one(chargingStations, {
    fields: [occupancyLiquidations.stationId],
    references: [chargingStations.id],
  }),
  hostUser: one(users, {
    fields: [occupancyLiquidations.hostUserId],
    references: [users.id],
  }),
}));

// ─────────────────────────────────────────────────────────────────
// SAAS LANDING — Solicitudes de demo y formularios de contacto
// ─────────────────────────────────────────────────────────────────
export const demoRequests = mysqlTable("demoRequests", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 120 }).notNull(),
  company: varchar("company", { length: 120 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 30 }),
  chargerCount: varchar("chargerCount", { length: 30 }),
  plan: varchar("plan", { length: 30 }),
  message: text("message"),
  status: varchar("status", { length: 30 }).notNull().default("pending"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type DemoRequest = typeof demoRequests.$inferSelect;
export type InsertDemoRequest = typeof demoRequests.$inferInsert;

export const contactSubmissions = mysqlTable("contactSubmissions", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 120 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 30 }),
  subject: varchar("subject", { length: 200 }).notNull(),
  message: text("message").notNull(),
  status: varchar("status", { length: 30 }).notNull().default("unread"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ContactSubmission = typeof contactSubmissions.$inferSelect;
export type InsertContactSubmission = typeof contactSubmissions.$inferInsert;

// ============================================================================
// WHATSAPP CONFIGURATION & NOTIFICATION LOG
// ============================================================================
export const whatsappConfig = mysqlTable("whatsapp_config", {
  id: int("id").autoincrement().primaryKey(),
  // Credenciales Meta / WhatsApp Business Cloud API
  phoneNumberId: varchar("phoneNumberId", { length: 100 }),
  wabaId: varchar("wabaId", { length: 100 }),
  accessToken: text("accessToken"),
  appSecret: text("appSecret"),
  verifyToken: varchar("verifyToken", { length: 255 }),
  // Número visible para el usuario (ej: +57 322 9587443)
  displayPhone: varchar("displayPhone", { length: 30 }),
  // Estado general
  enabled: boolean("enabled").default(false).notNull(),
  // Tipos de notificación habilitados
  notifyChargeStart: boolean("notifyChargeStart").default(true).notNull(),
  notifyChargeEnd: boolean("notifyChargeEnd").default(true).notNull(),
  notifyChargeProgress: boolean("notifyChargeProgress").default(false).notNull(),
  notifyPenalty: boolean("notifyPenalty").default(true).notNull(),
  notifyWalletRecharge: boolean("notifyWalletRecharge").default(true).notNull(),
  notifyChargerOffline: boolean("notifyChargerOffline").default(false).notNull(),
  notifyReservation: boolean("notifyReservation").default(true).notNull(),
  notifyMonthlySummary: boolean("notifyMonthlySummary").default(false).notNull(),
  // Metadata
  updatedBy: int("updatedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type WhatsappConfig = typeof whatsappConfig.$inferSelect;
export type InsertWhatsappConfig = typeof whatsappConfig.$inferInsert;

export const whatsappNotificationLog = mysqlTable("whatsapp_notification_log", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  toPhone: varchar("toPhone", { length: 30 }).notNull(),
  eventType: varchar("eventType", { length: 50 }).notNull(),
  messageBody: text("messageBody").notNull(),
  status: mysqlEnum("status", ["sent", "delivered", "read", "failed"]).default("sent").notNull(),
  wamid: varchar("wamid", { length: 128 }),
  errorMessage: text("errorMessage"),
  referenceId: int("referenceId"),
  referenceType: varchar("referenceType", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type WhatsappNotificationLog = typeof whatsappNotificationLog.$inferSelect;
export type InsertWhatsappNotificationLog = typeof whatsappNotificationLog.$inferInsert;
