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
} from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

// ============================================================================
// ENUMS
// ============================================================================

export const userRoleEnum = mysqlEnum("role", ["staff", "technician", "investor", "user", "admin"]);
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
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: userRoleEnum.default("user").notNull(),
  avatarUrl: text("avatarUrl"),
  isActive: boolean("isActive").default(true).notNull(),
  // idTag único para identificación OCPP (formato: EV-XXXXXX)
  idTag: varchar("idTag", { length: 20 }).unique(),
  // Para inversionistas - información adicional
  companyName: varchar("companyName", { length: 255 }),
  taxId: varchar("taxId", { length: 50 }), // NIT en Colombia
  bankAccount: varchar("bankAccount", { length: 100 }),
  bankName: varchar("bankName", { length: 100 }),
  // Para técnicos - información adicional
  technicianLicense: varchar("technicianLicense", { length: 100 }),
  assignedRegion: varchar("assignedRegion", { length: 100 }),
  // Token FCM para notificaciones push
  fcmToken: text("fcmToken"),
  fcmTokenUpdatedAt: timestamp("fcmTokenUpdatedAt"),
  // Preferencias de notificaciones
  notifyChargingComplete: boolean("notifyChargingComplete").default(true),
  notifyLowBalance: boolean("notifyLowBalance").default(true),
  notifyPromotions: boolean("notifyPromotions").default(true),
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
  // Datos de registro UPME/CárgaME
  upmeRegistrationId: varchar("upmeRegistrationId", { length: 100 }),
  cargameId: varchar("cargameId", { length: 100 }),
  // Firmware y modelo
  manufacturer: varchar("manufacturer", { length: 100 }),
  model: varchar("model", { length: 100 }),
  serialNumber: varchar("serialNumber", { length: 100 }),
  firmwareVersion: varchar("firmwareVersion", { length: 50 }),
  lastBootNotification: timestamp("lastBootNotification"),
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
  // Stripe
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 100 }),
  stripePriceId: varchar("stripePriceId", { length: 100 }),
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
  investorShare: decimal("investorShare", { precision: 14, scale: 2 }).notNull(), // 80%
  platformFee: decimal("platformFee", { precision: 14, scale: 2 }).notNull(), // 20%
  // Detalles
  transactionCount: int("transactionCount").notNull(),
  totalKwh: decimal("totalKwh", { precision: 12, scale: 4 }).notNull(),
  // Pago
  status: paymentStatusEnum.default("PENDING").notNull(),
  paidAt: timestamp("paidAt"),
  paymentMethod: varchar("paymentMethod", { length: 50 }), // BANK_TRANSFER, STRIPE
  paymentReference: varchar("paymentReference", { length: 100 }),
  // Notas
  notes: text("notes"),
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
  type: bannerTypeEnum.notNull(),
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
  status: bannerStatusEnum.default("DRAFT").notNull(),
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
  investorPercentage: int("investorPercentage").default(80).notNull(),
  platformFeePercentage: int("platformFeePercentage").default(20).notNull(),
  
  // Configuración de Stripe
  stripePublicKey: text("stripePublicKey"),
  stripeSecretKey: text("stripeSecretKey"),
  stripeWebhookSecret: text("stripeWebhookSecret"),
  stripeTestMode: boolean("stripeTestMode").default(true).notNull(),
  
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
  
  // Tarifas globales por defecto (configurables por admin)
  defaultReservationFee: decimal("defaultReservationFee", { precision: 10, scale: 2 }).default("5000").notNull(), // Fee de reserva por defecto
  defaultOverstayPenaltyPerMin: decimal("defaultOverstayPenaltyPerMin", { precision: 10, scale: 2 }).default("500").notNull(), // Penalización por minuto
  defaultConnectionFee: decimal("defaultConnectionFee", { precision: 10, scale: 2 }).default("2000").notNull(), // Tarifa de conexión
  
  // Tarifas diferenciadas por tipo de conector (AC vs DC)
  defaultPricePerKwhAC: decimal("defaultPricePerKwhAC", { precision: 10, scale: 2 }).default("800").notNull(), // Precio base AC (carga lenta)
  defaultPricePerKwhDC: decimal("defaultPricePerKwhDC", { precision: 10, scale: 2 }).default("1200").notNull(), // Precio base DC (carga rápida)
  enableDifferentiatedPricing: boolean("enableDifferentiatedPricing").default(true).notNull(), // Habilitar precios diferenciados AC/DC
  
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
