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

export const userRoleEnum = mysqlEnum("role", ["staff", "technician", "investor", "user", "admin", "engineer"]);
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
  // Tipo de inversionista y perfil público
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
  // Stripe customer ID
  stripeCustomerId: varchar("stripeCustomerId", { length: 100 }),
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
  // Stripe
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 100 }),
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
});

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

export const crowdfundingStatusEnum = mysqlEnum("crowdfunding_status", [
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
  paymentStatus: paymentStatusEnum.default("PENDING").notNull(),
  paymentDate: timestamp("paymentDate"),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
  
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
