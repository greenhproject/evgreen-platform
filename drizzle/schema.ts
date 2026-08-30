import { mysqlTable, mysqlSchema, AnyMySqlColumn, int, mysqlEnum, text, varchar, decimal, timestamp, json, bigint, index, uniqueIndex, date, tinyint, datetime, foreignKey, float } from "drizzle-orm/mysql-core"
import { sql } from "drizzle-orm"

export const aiConfig = mysqlTable("ai_config", {
	id: int().autoincrement().notNull(),
	aiProvider: mysqlEnum("ai_provider", ['manus','openai','anthropic','google','azure','custom']).default('manus').notNull(),
	openaiApiKey: text(),
	anthropicApiKey: text(),
	googleApiKey: text(),
	azureApiKey: text(),
	azureEndpoint: text(),
	customApiKey: text(),
	customEndpoint: text(),
	modelName: varchar({ length: 100 }),
	temperature: decimal({ precision: 3, scale: 2 }).default('0.7'),
	maxTokens: int().default(2000),
	enableChat: tinyint().default(1).notNull(),
	enableRecommendations: tinyint().default(1).notNull(),
	enableTripPlanner: tinyint().default(1).notNull(),
	enableInvestorInsights: tinyint().default(1).notNull(),
	enableAdminAnalytics: tinyint().default(1).notNull(),
	dailyUserLimit: int().default(50),
	dailyTotalLimit: int().default(10000),
	updatedBy: int(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const aiConversations = mysqlTable("ai_conversations", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	conversationType: varchar({ length: 50 }).default('chat').notNull(),
	title: varchar({ length: 255 }),
	context: json(),
	isActive: tinyint().default(1).notNull(),
	messageCount: int().default(0).notNull(),
	lastMessageAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const aiMessages = mysqlTable("ai_messages", {
	id: bigint({ mode: "number" }).autoincrement().notNull(),
	conversationId: int().notNull(),
	role: varchar({ length: 20 }).notNull(),
	content: text().notNull(),
	tokenCount: int(),
	provider: varchar({ length: 50 }),
	model: varchar({ length: 100 }),
	structuredData: json(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const aiUsage = mysqlTable("ai_usage", {
	id: bigint({ mode: "number" }).autoincrement().notNull(),
	userId: int().notNull(),
	usageType: varchar({ length: 50 }).notNull(),
	provider: varchar({ length: 50 }).notNull(),
	model: varchar({ length: 100 }),
	inputTokens: int().default(0),
	outputTokens: int().default(0),
	totalTokens: int().default(0),
	estimatedCost: decimal({ precision: 10, scale: 6 }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const apiKeys = mysqlTable("api_keys", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	organizationId: int("organization_id"),
	name: varchar({ length: 100 }).notNull(),
	keyHash: varchar({ length: 64 }).notNull(),
	keyPrefix: varchar({ length: 12 }).notNull(),
	permissions: json(),
	isActive: tinyint().default(1).notNull(),
	expiresAt: timestamp({ mode: 'string' }),
	lastUsedAt: timestamp({ mode: 'string' }),
	usageCount: int().default(0).notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
},
(table) => [
	index("api_keys_keyHash_unique").on(table.keyHash),
	index("idx_api_keys_organization_id").on(table.organizationId),
]);

export const apiWebhooks = mysqlTable("api_webhooks", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	organizationId: int("organization_id"),
	url: varchar({ length: 500 }).notNull(),
	events: json().notNull(),
	secret: varchar({ length: 64 }),
	isActive: tinyint().default(1).notNull(),
	lastTriggeredAt: timestamp({ mode: 'string' }),
	failCount: int().default(0).notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
}, (table) => [
	index("idx_api_webhooks_organization_id").on(table.organizationId),
]);

export const backupLogs = mysqlTable("backup_logs", {
	id: int().autoincrement().notNull(),
	backupType: mysqlEnum("backup_type", ['FULL','CRITICAL','FINANCIAL','USERS','MANUAL']).notNull(),
	backupStatus: mysqlEnum("backup_status", ['RUNNING','COMPLETED','FAILED','PARTIAL']).default('RUNNING').notNull(),
	startedAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	completedAt: timestamp({ mode: 'string' }),
	tablesIncluded: json(),
	totalRows: int().default(0),
	totalSizeBytes: bigint({ mode: "number" }),
	s3Url: text(),
	s3Key: varchar({ length: 500 }),
	errorMessage: text(),
	errorDetails: json(),
	triggeredBy: varchar({ length: 100 }).default('system'),
	isAutomatic: tinyint().default(1).notNull(),
	expiresAt: timestamp({ mode: 'string' }),
	isDeleted: tinyint().default(0).notNull(),
	notes: text(),
});

export const bannerDailyStats = mysqlTable("banner_daily_stats", {
	id: int().autoincrement().notNull(),
	bannerId: int().notNull(),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	date: date({ mode: 'string' }).notNull(),
	impressions: int().default(0).notNull(),
	clicks: int().default(0).notNull(),
	uniqueViews: int().default(0).notNull(),
	totalDwellSeconds: int().default(0).notNull(),
	dwellCount: int().default(0).notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("uq_banner_date").on(table.bannerId, table.date),
]);

export const bannerViews = mysqlTable("banner_views", {
	id: bigint({ mode: "number" }).autoincrement().notNull(),
	bannerId: int().notNull(),
	userId: int().notNull(),
	viewedAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	clicked: tinyint().default(0),
	clickedAt: timestamp({ mode: 'string' }),
	viewContext: varchar({ length: 50 }),
	sessionId: varchar({ length: 100 }),
	deviceType: varchar({ length: 50 }),
	viewDurationSeconds: int(),
	city: varchar({ length: 100 }),
	vehicleType: varchar({ length: 100 }),
	hourOfDay: tinyint(),
});

export const banners = mysqlTable("banners", {
	id: int().autoincrement().notNull(),
	title: varchar({ length: 255 }).notNull(),
	subtitle: varchar({ length: 500 }),
	description: text(),
	imageUrl: text().notNull(),
	imageUrlMobile: text(),
	bannerType: mysqlEnum("banner_type", ['SPLASH','CHARGING','MAP','PROMOTIONAL','INFORMATIONAL']).notNull(),
	linkUrl: text(),
	linkType: varchar({ length: 50 }),
	linkTarget: varchar({ length: 50 }),
	ctaText: varchar({ length: 100 }),
	startDate: timestamp({ mode: 'string' }),
	endDate: timestamp({ mode: 'string' }),
	targetRoles: json(),
	targetCities: json(),
	targetSubscriptionTiers: json(),
	priority: int().default(0).notNull(),
	displayDurationMs: int().default(5000),
	isClosable: tinyint().default(1),
	showOnce: tinyint().default(0),
	bannerStatus: mysqlEnum("banner_status", ['DRAFT','ACTIVE','PAUSED','EXPIRED','ARCHIVED']).default('DRAFT').notNull(),
	impressions: int().default(0).notNull(),
	clicks: int().default(0).notNull(),
	uniqueViews: int().default(0).notNull(),
	advertiserName: varchar({ length: 255 }),
	advertiserContact: varchar({ length: 255 }),
	campaignId: varchar({ length: 100 }),
	createdById: int(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	targetDepartments: json(),
	targetStationCities: json(),
	targetStationIds: json(),
	targetVehicleBrands: json(),
	targetVehicleModels: json(),
	targetConnectorTypes: json(),
	targetBatteryMinKwh: int(),
	targetBatteryMaxKwh: int(),
	targetMinChargesPerMonth: int(),
	targetMaxChargesPerMonth: int(),
	targetMinSpendPerMonth: int(),
	targetMaxSpendPerMonth: int(),
	targetStartMethods: json(),
	targetChargeHoursStart: int(),
	targetChargeHoursEnd: int(),
	targetHasCard: tinyint(),
	targetWalletMinBalance: int(),
	targetWalletMaxBalance: int(),
	targetMinAvgRecharge: int(),
	targetActivitySegments: json(),
});

export const chargerBrands = mysqlTable("charger_brands", {
	id: int().autoincrement().notNull(),
	brand: varchar({ length: 100 }).notNull(),
	model: varchar({ length: 100 }).notNull(),
	displayName: varchar({ length: 200 }).notNull(),
	imageUrl: text(),
	ocppVersion: varchar({ length: 20 }).default('1.6').notNull(),
	ocppPasswordRequired: tinyint().default(0).notNull(),
	chargeType: mysqlEnum("charge_type", ['AC','DC']).notNull(),
	defaultPowerKw: decimal({ precision: 8, scale: 2 }).notNull(),
	maxPowerKw: decimal({ precision: 8, scale: 2 }),
	minChargingCurrentA: int(),
	maxChargingCurrentA: int(),
	defaultVoltage: int(),
	phases: int().default(1),
	supportedConnectors: json(),
	supportedMeasurands: json(),
	energyUnit: varchar({ length: 10 }).default('Wh').notNull(),
	supportsSoC: tinyint().default(0).notNull(),
	supportsPowerMeasurement: tinyint().default(0).notNull(),
	supportsCurrentMeasurement: tinyint().default(0).notNull(),
	supportsVoltageMeasurement: tinyint().default(0).notNull(),
	supportsRemoteStart: tinyint().default(1).notNull(),
	supportsRemoteStop: tinyint().default(1).notNull(),
	supportsReset: tinyint().default(1).notNull(),
	supportsReservation: tinyint().default(0).notNull(),
	supportsSmartCharging: tinyint().default(0).notNull(),
	supportsFirmwareUpdate: tinyint().default(0).notNull(),
	ocppConfig: json(),
	meterValueInterval: int().default(30),
	cloudApiBaseUrl: varchar({ length: 500 }),
	cloudApiAuthMethod: varchar({ length: 50 }),
	cloudApiDocsUrl: varchar({ length: 500 }),
	notes: text(),
	isActive: tinyint().default(1).notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const chargerProblemReports = mysqlTable("charger_problem_reports", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	stationId: int(),
	stationName: varchar({ length: 255 }),
	connectorId: varchar({ length: 50 }),
	problemType: varchar({ length: 50 }).notNull(),
	description: text(),
	photoUrl: varchar({ length: 500 }),
	status: varchar({ length: 20 }).default('PENDING').notNull(),
	priority: varchar({ length: 20 }).default('MEDIUM').notNull(),
	assignedToId: int(),
	resolution: text(),
	resolvedAt: datetime({ mode: 'string'}),
	createdAt: datetime({ mode: 'string'}).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: datetime({ mode: 'string'}).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const chargersCatalog = mysqlTable("chargers_catalog", {
	id: int().autoincrement().notNull(),
	name: varchar({ length: 255 }).notNull(),
	slug: varchar({ length: 100 }).notNull(),
	powerKw: decimal({ precision: 8, scale: 2 }).notNull(),
	chargeType: mysqlEnum("charge_type", ['AC','DC']).notNull(),
	connectorType: varchar({ length: 50 }).notNull(),
	price: bigint({ mode: "number" }).notNull(),
	description: text(),
	features: json(),
	imageUrl: text(),
	includesTransformer: tinyint().default(0),
	cableMetersIncluded: int().default(10),
	warrantyYears: int().default(2),
	isActive: tinyint().default(1).notNull(),
	sortOrder: int().default(0),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	commissionPercent: decimal({ precision: 5, scale: 2 }).default('0.00').notNull(),
},
(table) => [
	index("chargers_catalog_slug_unique").on(table.slug),
]);

export const chargingStations = mysqlTable("charging_stations", {
	id: int().autoincrement().notNull(),
	ownerId: int().notNull(),
	name: varchar({ length: 255 }).notNull(),
	description: text(),
	address: varchar({ length: 500 }).notNull(),
	city: varchar({ length: 100 }).notNull(),
	department: varchar({ length: 100 }),
	country: varchar({ length: 100 }).default('Colombia').notNull(),
	timezone: varchar({ length: 100 }).default('America/Bogota').notNull(),
	postalCode: varchar({ length: 20 }),
	latitude: decimal({ precision: 10, scale: 8 }).notNull(),
	longitude: decimal({ precision: 11, scale: 8 }).notNull(),
	ocppIdentity: varchar({ length: 100 }),
	ocppPassword: varchar({ length: 255 }),
	isOnline: tinyint().default(0).notNull(),
	isPublic: tinyint().default(1).notNull(),
	// PRIVATE: solo operación interna del tenant; EVGREEN_NETWORK: visible en la app EVGreen;
	// ROAMING: visible en EVGreen y preparado para interoperabilidad OCPI autorizada.
	networkAccessMode: mysqlEnum("network_access_mode", ['PRIVATE','EVGREEN_NETWORK','ROAMING']).default('EVGREEN_NETWORK').notNull(),
	// Obligación regulatoria SIEM independiente de la participación comercial en ROAMING.
	siemReportingEnabled: tinyint("siem_reporting_enabled").default(0).notNull(),
	isActive: tinyint().default(1).notNull(),
	operatingHours: json(),
	amenities: json(),
	images: json(),
	upmeRegistrationId: varchar({ length: 100 }),
	cargameId: varchar({ length: 100 }),
	manufacturer: varchar({ length: 100 }),
	model: varchar({ length: 100 }),
	serialNumber: varchar({ length: 100 }),
	firmwareVersion: varchar({ length: 50 }),
	lastBootNotification: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	premiumZone: mysqlEnum(['A','B','C']).default('C').notNull(),
	premiumZoneFee: decimal({ precision: 15, scale: 2 }).default('0'),
	chargerBrandId: int(),
	imageUrl: text(),
	thumbnailUrl: varchar({ length: 500 }),
	contactPhone: varchar({ length: 20 }),
	investorSharePercent: decimal({ precision: 5, scale: 2 }).default('70.00').notNull(),
	hostSharePercent: decimal({ precision: 5, scale: 2 }).default('0.00').notNull(),
	energyPurchaseCostPerKwh: decimal({ precision: 10, scale: 2 }).default('850.00').notNull(),
	hostUserId: int(),
	hostName: varchar({ length: 255 }),
	evgreenSharePercent: decimal({ precision: 5, scale: 2 }).default('30.00').notNull(),
	maintenanceFundPercent: decimal({ precision: 5, scale: 2 }).default('5.00').notNull(),
	maintenanceFundAlertThreshold: decimal({ precision: 15, scale: 2 }).default('500000.00'),
	parkingRatePerMinute: int().default(0).notNull(),
	occupancyRatePerMinute: int().default(0).notNull(),
	organizationId: int("organization_id"),
	gestorId: int("gestor_id"),
	gestorCommissionPercent: decimal("gestor_commission_percent", { precision: 5, scale: 2 }).default('3.75').notNull(),
},
(table) => [
	index("charging_stations_ocppIdentity_unique").on(table.ocppIdentity),
	index("idx_station_network_visibility").on(table.networkAccessMode, table.isActive, table.isPublic),
	index("idx_station_siem_reporting").on(table.siemReportingEnabled, table.isActive, table.isPublic),
	index("idx_station_organization").on(table.organizationId),
]);

export const claims = mysqlTable("claims", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	userName: varchar({ length: 255 }).notNull(),
	transactionId: int().notNull(),
	category: varchar({ length: 50 }).notNull(),
	description: text().notNull(),
	requestedAmount: decimal({ precision: 12, scale: 2 }),
	status: varchar({ length: 30 }).default('PENDING').notNull(),
	resolvedByAdminId: int(),
	resolvedByAdminName: varchar({ length: 255 }),
	resolution: text(),
	refundId: int(),
	resolvedAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const contactSubmissions = mysqlTable("contactSubmissions", {
	id: int().autoincrement().notNull(),
	name: varchar({ length: 120 }).notNull(),
	email: varchar({ length: 255 }).notNull(),
	phone: varchar({ length: 30 }),
	subject: varchar({ length: 200 }).notNull(),
	message: text().notNull(),
	status: varchar({ length: 30 }).default('unread').notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const crowdfundingParticipations = mysqlTable("crowdfunding_participations", {
	id: int().autoincrement().notNull(),
	projectId: int().notNull(),
	investorId: int().notNull(),
	amount: bigint({ mode: "number" }).notNull(),
	participationPercent: decimal({ precision: 6, scale: 4 }).notNull(),
	paymentStatus: mysqlEnum(['PENDING','COMPLETED','FAILED','REFUNDED']).default('PENDING').notNull(),
	paymentDate: timestamp({ mode: 'string' }),
	paymentReference: varchar({ length: 255 }),
	contractSigned: tinyint().default(0).notNull(),
	contractSignedAt: timestamp({ mode: 'string' }),
	contractUrl: text(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const crowdfundingProjects = mysqlTable("crowdfunding_projects", {
	id: int().autoincrement().notNull(),
	name: varchar({ length: 255 }).notNull(),
	description: text(),
	city: varchar({ length: 100 }).notNull(),
	zone: varchar({ length: 255 }).notNull(),
	address: varchar({ length: 500 }),
	targetAmount: bigint({ mode: "number" }).notNull(),
	raisedAmount: bigint({ mode: "number" }).notNull(),
	minimumInvestment: bigint({ mode: "number" }).default(50000000).notNull(),
	totalPowerKw: int().default(480).notNull(),
	chargerCount: int().default(4).notNull(),
	chargerPowerKw: int().default(120).notNull(),
	hasSolarPanels: tinyint().default(1).notNull(),
	estimatedRoiPercent: decimal({ precision: 5, scale: 2 }).default('85.00'),
	estimatedPaybackMonths: int().default(14),
	status: mysqlEnum(['DRAFT','OPEN','IN_PROGRESS','FUNDED','COMPLETED','CANCELLED']).default('DRAFT').notNull(),
	targetDate: timestamp({ mode: 'string' }),
	launchDate: timestamp({ mode: 'string' }),
	fundedDate: timestamp({ mode: 'string' }),
	operationalDate: timestamp({ mode: 'string' }),
	priority: int().default(0).notNull(),
	stationId: int(),
	createdById: int(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	spaceSubmissionId: int(),
	spaceInheritanceSnapshot: json("space_inheritance_snapshot"),
	financialOverrideReason: text("financial_override_reason"),
	financialOverrideAt: timestamp("financial_override_at", { mode: 'string' }),
	financialOverrideBy: int("financial_override_by"),
});

export const demoRequests = mysqlTable("demoRequests", {
	id: int().autoincrement().notNull(),
	name: varchar({ length: 120 }).notNull(),
	company: varchar({ length: 120 }).notNull(),
	email: varchar({ length: 255 }).notNull(),
	phone: varchar({ length: 30 }),
	chargerCount: varchar({ length: 30 }),
	plan: varchar({ length: 30 }),
	message: text(),
	status: varchar({ length: 30 }).default('pending').notNull(),
	notes: text(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const eventGuests = mysqlTable("event_guests", {
	id: int().autoincrement().notNull(),
	fullName: varchar({ length: 255 }).notNull(),
	email: varchar({ length: 320 }).notNull(),
	phone: varchar({ length: 20 }),
	company: varchar({ length: 255 }),
	position: varchar({ length: 255 }),
	qrCode: varchar({ length: 100 }).notNull(),
	investmentPackage: mysqlEnum("investment_package", ['AC','DC_INDIVIDUAL','COLECTIVO']),
	investmentAmount: bigint({ mode: "number" }),
	founderSlot: int(),
	eventGuestStatus: mysqlEnum("event_guest_status", ['INVITED','CONFIRMED','CHECKED_IN','NO_SHOW','CANCELLED']).default('INVITED').notNull(),
	invitationSentAt: timestamp({ mode: 'string' }),
	invitationEmailId: varchar({ length: 255 }),
	checkedInAt: timestamp({ mode: 'string' }),
	checkedInBy: int(),
	userId: int(),
	notes: text(),
	createdById: int(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("qrCode").on(table.qrCode),
	index("event_guests_qrCode_unique").on(table.qrCode),
]);

export const eventPayments = mysqlTable("event_payments", {
	id: int().autoincrement().notNull(),
	guestId: int().notNull(),
	amount: bigint({ mode: "number" }).notNull(),
	reservationDeposit: bigint({ mode: "number" }).default(1000000).notNull(),
	eventPaymentStatus: mysqlEnum("event_payment_status", ['PENDING','PAID','PARTIAL','REFUNDED']).default('PENDING').notNull(),
	paymentMethod: varchar({ length: 50 }),
	paymentReference: varchar({ length: 255 }),
	wompiTransactionId: varchar({ length: 255 }),
	selectedPackage: mysqlEnum("selected_package", ['AC','DC_INDIVIDUAL','COLECTIVO']).notNull(),
	founderBenefits: tinyint().default(1).notNull(),
	founderDiscount: decimal({ precision: 5, scale: 2 }).default('5.00'),
	zoneFeeFree: tinyint().default(1),
	registeredById: int(),
	paidAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const evses = mysqlTable("evses", {
	id: int().autoincrement().notNull(),
	stationId: int().notNull(),
	evseIdLocal: int().notNull(),
	connectorId: int().default(1).notNull(),
	connectorType: mysqlEnum("connector_type", ['TYPE_1','TYPE_2','CCS_1','CCS_2','CHADEMO','TESLA','GBT_AC','GBT_DC']).notNull(),
	chargeType: mysqlEnum("charge_type", ['AC','DC']).notNull(),
	powerKw: decimal({ precision: 8, scale: 2 }).notNull(),
	maxVoltage: int(),
	maxAmperage: int(),
	connectorStatus: mysqlEnum("connector_status", ['AVAILABLE','PREPARING','CHARGING','SUSPENDED_EVSE','SUSPENDED_EV','FINISHING','RESERVED','UNAVAILABLE','FAULTED']).default('UNAVAILABLE').notNull(),
	lastStatusUpdate: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	currentTransactionId: int(),
	currentUserId: int(),
	chargerId: int("charger_id"),
	isActive: tinyint().default(1).notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
	(table) => [
		index("idx_evses_station").on(table.stationId),
	]);

export const ocpiSyncRuns = mysqlTable("ocpi_sync_runs", {
	id: int().autoincrement().notNull(),
	stationId: int(),
	operation: mysqlEnum("ocpi_sync_operation", ['CATALOG_PREVIEW','LOCATION_PUBLISH','LOCATION_RECEIVED','LOCATION_REJECTED']).notNull(),
	status: mysqlEnum("ocpi_sync_status", ['PENDING','SKIPPED','SUCCESS','FAILED']).notNull(),
	message: text(),
	details: json(),
	createdBy: int(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	completedAt: timestamp({ mode: 'string' }),
}, (table) => [
  index("idx_ocpi_sync_runs_station_created").on(table.stationId, table.createdAt),
  index("idx_ocpi_sync_runs_status_created").on(table.status, table.createdAt),
]);

export const ocpiRemoteLocations = mysqlTable("ocpi_remote_locations", {
  id: int().autoincrement().notNull(),
  provider: varchar({ length: 32 }).default("CARGAME").notNull(),
  countryCode: varchar("country_code", { length: 2 }).notNull(),
  partyId: varchar("party_id", { length: 3 }).notNull(),
  locationId: varchar("location_id", { length: 64 }).notNull(),
  name: varchar({ length: 255 }),
  address: varchar({ length: 255 }),
  city: varchar({ length: 120 }),
  latitude: varchar({ length: 32 }),
  longitude: varchar({ length: 32 }),
  status: varchar({ length: 32 }).default("ACTIVE").notNull(),
  lastUpdated: datetime("last_updated", { mode: "string" }),
  rawLocation: json("raw_location").notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("idx_ocpi_remote_location_partner").on(table.provider, table.countryCode, table.partyId, table.locationId),
	index("idx_ocpi_remote_locations_updated").on(table.provider, table.updatedAt),
]);

export const ocpiOutboxEvents = mysqlTable("ocpi_outbox_events", {
  id: int().autoincrement().notNull(),
  scope: mysqlEnum("ocpi_outbox_scope", ["SIEM", "ROAMING"]).default("SIEM").notNull(),
  eventType: mysqlEnum("ocpi_outbox_event_type", ["LOCATION_UPSERT", "TARIFF_UPSERT", "SESSION_UPSERT", "EVSE_STATUS"]).notNull(),
  organizationId: int("organization_id"),
  stationId: int("station_id"),
  dedupeKey: varchar("dedupe_key", { length: 191 }).notNull(),
  payload: json().notNull(),
  status: mysqlEnum("ocpi_outbox_status", ["PENDING", "SENT", "FAILED", "DEAD"]).default("PENDING").notNull(),
  attemptCount: int("attempt_count").default(0).notNull(),
  nextAttemptAt: timestamp("next_attempt_at", { mode: "string" }),
  lastError: varchar("last_error", { length: 500 }),
  sentAt: timestamp("sent_at", { mode: "string" }),
  createdAt: timestamp("created_at", { mode: "string" }).default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("uq_ocpi_outbox_dedupe").on(table.dedupeKey),
  index("idx_ocpi_outbox_status_created").on(table.status, table.createdAt),
  index("idx_ocpi_outbox_station").on(table.stationId, table.createdAt),
  index("idx_ocpi_outbox_organization").on(table.organizationId, table.createdAt),
]);

export const favoriteStations = mysqlTable("favorite_stations", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	stationId: int().notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
},
(table) => [
	index("favorite_stations_userId_idx").on(table.userId),
	index("favorite_stations_stationId_idx").on(table.stationId),
]);

export const financialReports = mysqlTable("financial_reports", {
	id: int().autoincrement().notNull(),
	stationId: int().notNull(),
	reportType: mysqlEnum(['monthly_pl','quarterly_pl','annual_pl','waterfall','investor_statement','tax_certificate']).notNull(),
	periodLabel: varchar({ length: 50 }).notNull(),
	periodStart: bigint({ mode: "number" }).notNull(),
	periodEnd: bigint({ mode: "number" }).notNull(),
	fileUrl: text(),
	fileKey: varchar({ length: 255 }),
	generatedBy: int(),
	status: mysqlEnum(['generating','ready','error']).default('generating').notNull(),
	metadata: json(),
	createdAt: bigint({ mode: "number" }).notNull(),
},
(table) => [
	index("idx_fr_station").on(table.stationId),
	index("idx_fr_type").on(table.reportType),
]);

export const financialSettlements = mysqlTable("financial_settlements", {
	id: int().autoincrement().notNull(),
	stationId: int().notNull(),
	periodStart: timestamp({ mode: 'string' }).notNull(),
	periodEnd: timestamp({ mode: 'string' }).notNull(),
	settlementPeriodType: mysqlEnum("settlement_period_type", ['WEEKLY','MONTHLY','QUARTERLY']).notNull(),
	grossRevenue: bigint({ mode: "number" }).notNull(),
	totalSessions: int().default(0).notNull(),
	totalKwh: decimal({ precision: 12, scale: 4 }).default('0'),
	totalFixedExpenses: bigint({ mode: "number" }).notNull(),
	netRevenue: bigint({ mode: "number" }).notNull(),
	totalEnergyCost: bigint({ mode: "number" }).notNull(),
	energyCostPerKwh: decimal({ precision: 10, scale: 2 }).default('850.00'),
	revenueFromEnergy: bigint({ mode: "number" }).notNull(),
	revenueFromPenalties: bigint({ mode: "number" }).notNull(),
	revenueFromReservations: bigint({ mode: "number" }).notNull(),
	revenueFromAdvertising: bigint({ mode: "number" }).notNull(),
	investorSharePercent: decimal({ precision: 5, scale: 2 }).default('70.00').notNull(),
	platformSharePercent: decimal({ precision: 5, scale: 2 }).default('30.00').notNull(),
	hostSharePercent: decimal({ precision: 5, scale: 2 }).default('0.00').notNull(),
	investorTotalAmount: bigint({ mode: "number" }).notNull(),
	platformTotalAmount: bigint({ mode: "number" }).notNull(),
	hostTotalAmount: bigint({ mode: "number" }).notNull(),
	maintenanceFundPercent: decimal({ precision: 5, scale: 2 }).default('5.00').notNull(),
	maintenanceFundAmount: bigint({ mode: "number" }).notNull(),
	platformNetAmount: bigint({ mode: "number" }).notNull(),
	contingencyReserve: bigint({ mode: "number" }).notNull(),
	waterfallBreakdown: json(),
	settlementStatus: mysqlEnum("settlement_status", ['DRAFT','APPROVED','DISTRIBUTED','CLOSED']).default('DRAFT').notNull(),
	approvedBy: int(),
	approvedAt: timestamp({ mode: 'string' }),
	distributedAt: timestamp({ mode: 'string' }),
	notes: text(),
	createdBy: int().notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const firmwareUpdates = mysqlTable("firmware_updates", {
	id: int().autoincrement().notNull(),
	stationId: int("station_id").notNull(),
	ocppIdentity: varchar("ocpp_identity", { length: 255 }).notNull(),
	fileName: varchar("file_name", { length: 500 }).notNull(),
	fileSize: int("file_size").notNull(),
	fileUrl: text("file_url").notNull(),
	version: varchar({ length: 100 }),
	status: varchar({ length: 50 }).default('PENDING').notNull(),
	progress: int().default(0),
	initiatedBy: int("initiated_by"),
	startedAt: timestamp("started_at", { mode: 'string' }),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	errorMessage: text("error_message"),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
},
(table) => [
	index("idx_station_id").on(table.stationId),
	index("idx_ocpp_identity").on(table.ocppIdentity),
	index("idx_status").on(table.status),
]);

export const idTags = mysqlTable("id_tags", {
	id: int().autoincrement().notNull(),
	idTag: varchar("id_tag", { length: 50 }).notNull(),
	userId: int("user_id"),
	idTagType: mysqlEnum("id_tag_type", ['APP','RFID','NFC','REMOTE']).default('APP').notNull(),
	idTagStatus: mysqlEnum("id_tag_status", ['ACTIVE','BLOCKED','EXPIRED','LOST']).default('ACTIVE').notNull(),
	label: varchar({ length: 100 }),
	serialNumber: varchar("serial_number", { length: 100 }),
	expiresAt: timestamp("expires_at", { mode: 'string' }),
	parentIdTag: varchar("parent_id_tag", { length: 50 }),
	maxActiveTransactions: int("max_active_transactions").default(1),
	lastUsedAt: timestamp("last_used_at", { mode: 'string' }),
	lastUsedStationId: int("last_used_station_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("id_tags_id_tag_unique").on(table.idTag),
]);

export const investorLeads = mysqlTable("investor_leads", {
	id: int().autoincrement().notNull(),
	spaceId: int().notNull(),
	name: varchar({ length: 255 }).notNull(),
	email: varchar({ length: 320 }).notNull(),
	phone: varchar({ length: 20 }),
	interestedAmount: bigint({ mode: "number" }),
	message: text(),
	leadStatus: mysqlEnum("lead_status", ['new','contacted','converted','discarded']).default('new').notNull(),
	adminNotes: text(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const investorPayouts = mysqlTable("investor_payouts", {
	id: int().autoincrement().notNull(),
	investorId: int().notNull(),
	periodStart: timestamp({ mode: 'string' }).notNull(),
	periodEnd: timestamp({ mode: 'string' }).notNull(),
	totalRevenue: decimal({ precision: 14, scale: 2 }).notNull(),
	investorShare: decimal({ precision: 14, scale: 2 }).notNull(),
	platformFee: decimal({ precision: 14, scale: 2 }).notNull(),
	transactionCount: int().notNull(),
	totalKwh: decimal({ precision: 12, scale: 4 }).notNull(),
	status: mysqlEnum(['PENDING','REQUESTED','APPROVED','PROCESSING','PAID','REJECTED']).default('PENDING').notNull(),
	paidAt: timestamp({ mode: 'string' }),
	paymentMethod: varchar({ length: 50 }),
	paymentReference: varchar({ length: 100 }),
	notes: text(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	investorPercentage: int().default(80).notNull(),
	bankName: varchar({ length: 100 }),
	bankAccount: varchar({ length: 100 }),
	accountHolder: varchar({ length: 255 }),
	accountType: varchar({ length: 50 }),
	requestedAt: timestamp({ mode: 'string' }),
	approvedAt: timestamp({ mode: 'string' }),
	approvedBy: int(),
	investorNotes: text(),
	adminNotes: text(),
	rejectionReason: text(),
});

export const investorSettlementShares = mysqlTable("investor_settlement_shares", {
	id: int().autoincrement().notNull(),
	settlementId: int().notNull(),
	investorUserId: int().notNull(),
	participationPercent: decimal({ precision: 8, scale: 4 }).notNull(),
	grossShare: bigint({ mode: "number" }).notNull(),
	expenseShare: bigint({ mode: "number" }).notNull(),
	netShare: bigint({ mode: "number" }).notNull(),
	investorShareStatus: mysqlEnum("investor_share_status", ['PENDING','CREDITED','PAID']).default('PENDING').notNull(),
	creditedAt: timestamp({ mode: 'string' }),
	paymentReference: varchar({ length: 255 }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const localAuthEntries = mysqlTable("local_auth_entries", {
	id: int().autoincrement().notNull(),
	listId: int().notNull(),
	stationId: int().notNull(),
	idTag: varchar({ length: 50 }).notNull(),
	idTagRefId: int(),
	authStatus: mysqlEnum("auth_status", ['Accepted','Blocked','Expired','ConcurrentTx']).default('Accepted').notNull(),
	expiryDate: timestamp({ mode: 'string' }),
	isMasterCard: tinyint().default(0).notNull(),
	label: varchar({ length: 100 }),
	addedBy: int(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const localAuthLists = mysqlTable("local_auth_lists", {
	id: int().autoincrement().notNull(),
	stationId: int().notNull(),
	listVersion: int().default(0).notNull(),
	chargerListVersion: int().default(0),
	localAuthListStatus: mysqlEnum("local_auth_list_status", ['SYNCED','PENDING','FAILED','OUTDATED']).default('PENDING').notNull(),
	lastSyncAt: timestamp({ mode: 'string' }),
	lastSyncResult: varchar({ length: 50 }),
	offlinePolicy: mysqlEnum("offline_policy", ['LOCAL_LIST_ONLY','FREE_VENDING','REJECT_ALL']).default('LOCAL_LIST_ONLY').notNull(),
	entryCount: int().default(0).notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const loyaltyConfig = mysqlTable("loyalty_config", {
	id: int().autoincrement().notNull(),
	pointsPerKwh: decimal({ precision: 6, scale: 2 }).default('1.00').notNull(),
	pointValueCop: decimal({ precision: 10, scale: 2 }).default('75.00').notNull(),
	minRedemptionPoints: int().default(100).notNull(),
	maxRedemptionPercent: decimal({ precision: 5, scale: 2 }).default('20.00').notNull(),
	marketplaceUrl: text(),
	marketplaceName: varchar({ length: 100 }).default('Marketplace EVGreen'),
	marketplaceDescription: varchar({ length: 300 }),
	enabled: tinyint().default(1).notNull(),
	termsUrl: text(),
	updatedBy: int(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const loyaltyPoints = mysqlTable("loyalty_points", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	points: decimal({ precision: 10, scale: 2 }).notNull(),
	balanceAfter: decimal({ precision: 10, scale: 2 }).notNull(),
	source: mysqlEnum(['charge_session','redemption','bonus','adjustment','expiry']).notNull(),
	transactionId: int(),
	kwhCharged: decimal({ precision: 10, scale: 4 }),
	description: varchar({ length: 200 }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
},
(table) => [
	index("idx_loyalty_points_user").on(table.userId),
	index("idx_loyalty_points_tx").on(table.transactionId),
]);

export const loyaltyRedemptions = mysqlTable("loyalty_redemptions", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	pointsUsed: decimal({ precision: 10, scale: 2 }).notNull(),
	discountAmountCop: decimal({ precision: 12, scale: 2 }).notNull(),
	redemptionType: mysqlEnum(['charge_discount','marketplace']).notNull(),
	transactionId: int(),
	status: mysqlEnum(['pending','applied','cancelled']).default('pending').notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	appliedAt: timestamp({ mode: 'string' }),
},
(table) => [
	index("idx_loyalty_redemptions_user").on(table.userId),
]);

export const maintenanceFundRecords = mysqlTable("maintenance_fund_records", {
	id: int().autoincrement().notNull(),
	stationId: int().notNull(),
	maintenanceFundType: mysqlEnum("maintenance_fund_type", ['deposit','withdrawal']).notNull(),
	amount: bigint({ mode: "number" }).notNull(),
	description: text().notNull(),
	maintenanceType: varchar({ length: 100 }),
	maintenanceDetail: text(),
	technicianName: varchar({ length: 255 }),
	invoiceNumber: varchar({ length: 100 }),
	settlementId: int(),
	balanceAfter: bigint({ mode: "number" }).notNull(),
	createdBy: int(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const maintenanceTasks = mysqlTable("maintenance_tasks", {
	id: int().autoincrement().notNull(),
	scheduleId: int().notNull(),
	stationId: int().notNull(),
	title: varchar({ length: 255 }).notNull(),
	description: text(),
	maintenanceType: varchar({ length: 100 }).notNull(),
	dueDate: timestamp({ mode: 'string' }).notNull(),
	scheduledDate: timestamp({ mode: 'string' }),
	completedDate: timestamp({ mode: 'string' }),
	assignedTechnicianId: int(),
	status: mysqlEnum(['pending','in_progress','completed','overdue','cancelled']).default('pending').notNull(),
	completionNotes: text(),
	actualCostCop: bigint({ mode: "number" }),
	fundRecordId: int(),
	qualityRating: int(),
	ratingNotes: text(),
	ratedBy: int(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const maintenanceTickets = mysqlTable("maintenance_tickets", {
	id: int().autoincrement().notNull(),
	stationId: int().notNull(),
	evseId: int(),
	technicianId: int(),
	reportedById: int(),
	title: varchar({ length: 255 }).notNull(),
	description: text(),
	priority: varchar({ length: 20 }).default('MEDIUM'),
	category: varchar({ length: 50 }),
	maintenanceStatus: mysqlEnum("maintenance_status", ['PENDING','IN_PROGRESS','COMPLETED','CANCELLED']).default('PENDING').notNull(),
	scheduledDate: timestamp({ mode: 'string' }),
	startedAt: timestamp({ mode: 'string' }),
	completedAt: timestamp({ mode: 'string' }),
	resolution: text(),
	partsUsed: json(),
	laborCost: decimal({ precision: 12, scale: 2 }),
	totalCost: decimal({ precision: 12, scale: 2 }),
	attachments: json(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const meterValues = mysqlTable("meter_values", {
	id: bigint({ mode: "number" }).autoincrement().notNull(),
	transactionId: int().notNull(),
	evseId: int().notNull(),
	timestamp: timestamp({ mode: 'string' }).notNull(),
	energyKwh: decimal({ precision: 12, scale: 4 }),
	powerKw: decimal({ precision: 8, scale: 2 }),
	voltage: decimal({ precision: 6, scale: 2 }),
	current: decimal({ precision: 6, scale: 2 }),
	soc: int(),
	temperature: decimal({ precision: 5, scale: 2 }),
	context: varchar({ length: 50 }),
	measurand: varchar({ length: 100 }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const notifications = mysqlTable("notifications", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	title: varchar({ length: 255 }).notNull(),
	message: text().notNull(),
	type: varchar({ length: 50 }).notNull(),
	referenceId: int(),
	referenceType: varchar({ length: 50 }),
	isRead: tinyint().default(0).notNull(),
	readAt: timestamp({ mode: 'string' }),
	pushSent: tinyint().default(0),
	pushSentAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	data: text(),
});

export const occupancyLiquidations = mysqlTable("occupancy_liquidations", {
	id: int().autoincrement().notNull(),
	transactionId: int().notNull(),
	stationId: int().notNull(),
	hostUserId: int(),
	minutesCharged: decimal({ precision: 8, scale: 2 }).notNull(),
	occupancyRatePerMinute: int().notNull(),
	parkingRatePerMinute: int().notNull(),
	userCharge: int().notNull(),
	allyTransfer: int().notNull(),
	evgreenMargin: int().notNull(),
	allyPaidAt: timestamp({ mode: 'string' }),
	periodYear: int().notNull(),
	periodMonth: int().notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const ocppAlerts = mysqlTable("ocpp_alerts", {
	id: int().autoincrement().notNull(),
	stationId: int(),
	ocppIdentity: varchar({ length: 100 }).notNull(),
	ocppAlertType: mysqlEnum("ocpp_alert_type", ['DISCONNECTION','ERROR','FAULT','OFFLINE_TIMEOUT','BOOT_REJECTED','TRANSACTION_ERROR']).notNull(),
	ocppAlertSeverity: mysqlEnum("ocpp_alert_severity", ['info','warning','critical']).notNull(),
	title: varchar({ length: 255 }).notNull(),
	message: text().notNull(),
	payload: json(),
	acknowledged: tinyint().default(0).notNull(),
	acknowledgedAt: timestamp({ mode: 'string' }),
	acknowledgedBy: int(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	resolvedAt: timestamp({ mode: 'string' }),
	autoResolved: tinyint().default(0).notNull(),
	resolvedReason: varchar({ length: 255 }),
});

export const ocppLogs = mysqlTable("ocpp_logs", {
	id: bigint({ mode: "number" }).autoincrement().notNull(),
	stationId: int(),
	ocppIdentity: varchar({ length: 100 }),
	direction: varchar({ length: 10 }).notNull(),
	messageType: varchar({ length: 50 }).notNull(),
	messageId: varchar({ length: 100 }),
	payload: json(),
	errorCode: varchar({ length: 50 }),
	errorDescription: text(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
},
(table) => [
	index("idx_ocpp_logs_identity_type_created").on(table.ocppIdentity, table.messageType, table.createdAt),
	index("idx_ocpp_logs_created").on(table.createdAt),
]);

export const offlineTransactions = mysqlTable("offline_transactions", {
	id: int().autoincrement().notNull(),
	stationId: int().notNull(),
	ocppTransactionId: varchar({ length: 100 }),
	idTag: varchar({ length: 50 }),
	connectorId: int(),
	meterStart: decimal({ precision: 12, scale: 4 }),
	meterEnd: decimal({ precision: 12, scale: 4 }),
	startTimestamp: timestamp({ mode: 'string' }),
	endTimestamp: timestamp({ mode: 'string' }),
	reconciled: tinyint().default(0).notNull(),
	reconciledAt: timestamp({ mode: 'string' }),
	reconciledTransactionId: int(),
	notes: text(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const operationalMetrics = mysqlTable("operational_metrics", {
	id: int().autoincrement().notNull(),
	stationId: int().notNull(),
	periodStart: timestamp({ mode: 'string' }).notNull(),
	periodEnd: timestamp({ mode: 'string' }).notNull(),
	availabilityPercent: decimal({ precision: 5, scale: 2 }).default('0'),
	totalUptimeHours: decimal({ precision: 10, scale: 2 }).default('0'),
	totalDowntimeHours: decimal({ precision: 10, scale: 2 }).default('0'),
	avgCriticalResponseHours: decimal({ precision: 8, scale: 2 }).default('0'),
	criticalTicketsCount: int().default(0),
	criticalTicketsResolved: int().default(0),
	platformUptimePercent: decimal({ precision: 5, scale: 2 }).default('99.50'),
	userSatisfactionScore: decimal({ precision: 3, scale: 2 }).default('0'),
	totalReviews: int().default(0),
	billingAccuracyPercent: decimal({ precision: 5, scale: 2 }).default('100.00'),
	totalTransactions: int().default(0),
	disputedTransactions: int().default(0),
	solarGenerationPercent: decimal({ precision: 5, scale: 2 }).default('0'),
	solarKwhGenerated: decimal({ precision: 12, scale: 4 }).default('0'),
	solarKwhExpected: decimal({ precision: 12, scale: 4 }).default('0'),
	slaStatus: mysqlEnum("sla_status", ['COMPLIANT','WARNING','BREACH']).default('COMPLIANT').notNull(),
	slaBreachCount: int().default(0),
	consecutiveBreachMonths: int().default(0),
	penaltyApplied: varchar({ length: 100 }),
	calculatedAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const orgBillingRecords = mysqlTable("org_billing_records", {
	id: int().autoincrement().notNull(),
	organizationId: int("organization_id").notNull(),
	billingType: mysqlEnum("billing_type", ['setup','annual_renewal','transaction_fee','support_fee','minimum_fee']).notNull(),
	description: varchar({ length: 500 }),
	amount: decimal({ precision: 12, scale: 2 }).notNull(),
	currency: varchar({ length: 3 }).default('USD').notNull(),
	periodStart: timestamp("period_start", { mode: 'string' }),
	periodEnd: timestamp("period_end", { mode: 'string' }),
	transactionCount: int("transaction_count"),
	totalTransactionVolume: decimal("total_transaction_volume", { precision: 14, scale: 2 }),
	billingStatus: mysqlEnum("billing_status", ['pending','paid','overdue','cancelled']).default('pending').notNull(),
	paidAt: timestamp("paid_at", { mode: 'string' }),
	invoiceUrl: text("invoice_url"),
	createdAt: timestamp("created_at", { mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
},
(table) => [
	index("idx_org_id").on(table.organizationId),
	index("idx_billing_status").on(table.billingStatus),
]);

export const orgUsers = mysqlTable("org_users", {
	id: int().autoincrement().notNull(),
	organizationId: int("organization_id").notNull(),
	userId: int("user_id").notNull(),
	role: mysqlEnum(['admin','viewer']).default('admin').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
},
(table) => [
	index("uq_org_user").on(table.organizationId, table.userId),
]);

export const organizations = mysqlTable("organizations", {
	id: int().autoincrement().notNull(),
	name: varchar({ length: 200 }).notNull(),
	slug: varchar({ length: 100 }).notNull(),
	orgPlan: mysqlEnum("org_plan", ['starter','professional','enterprise']).default('starter').notNull(),
	orgStatus: mysqlEnum("org_status", ['active','suspended','trial','cancelled']).default('trial').notNull(),
	contactName: varchar("contact_name", { length: 200 }),
	contactEmail: varchar("contact_email", { length: 200 }),
	contactPhone: varchar("contact_phone", { length: 50 }),
	nit: varchar({ length: 50 }),
	logoUrl: text("logo_url"),
	primaryColor: varchar("primary_color", { length: 20 }).default('#22c55e'),
	secondaryColor: varchar("secondary_color", { length: 20 }).default('#1e40af'),
	customDomain: varchar("custom_domain", { length: 200 }),
	appName: varchar("app_name", { length: 100 }),
	networkMember: tinyint("network_member").default(1).notNull(),
	setupFeePerCharger: decimal("setup_fee_per_charger", { precision: 10, scale: 2 }),
	annualFeePerCharger: decimal("annual_fee_per_charger", { precision: 10, scale: 2 }),
	transactionFeePercent: decimal("transaction_fee_percent", { precision: 5, scale: 2 }),
	supportFeePercent: decimal("support_fee_percent", { precision: 5, scale: 2 }),
	networkDiscount: decimal("network_discount", { precision: 5, scale: 2 }).default('1.00'),
	minMonthlyFeePerCharger: decimal("min_monthly_fee_per_charger", { precision: 10, scale: 2 }),
	supportIncluded: tinyint("support_included").default(0).notNull(),
	maxChargers: int("max_chargers").default(10),
	roamingOwnerPercent: decimal("roaming_owner_percent", { precision: 5, scale: 2 }).default('80.00'),
	roamingPlatformPercent: decimal("roaming_platform_percent", { precision: 5, scale: 2 }).default('15.00'),
	roamingReferralPercent: decimal("roaming_referral_percent", { precision: 5, scale: 2 }).default('5.00'),
	billingEmail: varchar("billing_email", { length: 200 }),
	nextBillingDate: timestamp("next_billing_date", { mode: 'string' }),
	trialEndsAt: timestamp("trial_ends_at", { mode: 'string' }),
	notes: text(),
	ownerId: varchar("owner_id", { length: 255 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	enabledModules: json("enabled_modules"),
	supportMode: mysqlEnum("support_mode", ['org_only','evgreen_included']).default('org_only').notNull(),
	supportChatEmbed: text("support_chat_embed"),
	supportWhatsapp: varchar("support_whatsapp", { length: 50 }),
	supportPhone: varchar("support_phone", { length: 50 }),
	supportEmail: varchar("support_email", { length: 200 }),
},
(table) => [
	index("idx_org_slug").on(table.slug),
]);

export const overstayLocks = mysqlTable("overstay_locks", {
	id: int().autoincrement().notNull(),
	evseId: int().notNull(),
	transactionId: int().notNull(),
	instanceId: varchar({ length: 100 }).notNull(),
	lastHeartbeat: timestamp({ mode: 'string' }).notNull(),
	accumulatedCost: decimal({ precision: 12, scale: 2 }).default('0'),
	lastChargeTime: timestamp({ mode: 'string' }).notNull(),
	startedAt: timestamp({ mode: 'string' }).notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	finishingNotified: tinyint().default(0).notNull(),
	graceWarningNotified: tinyint().default(0).notNull(),
});

export const partnerApplications = mysqlTable("partner_applications", {
	id: int().autoincrement().notNull(),
	companyName: text("company_name").notNull(),
	contactName: text("contact_name").notNull(),
	email: varchar({ length: 255 }).notNull(),
	phone: varchar({ length: 50 }).notNull(),
	city: varchar({ length: 100 }),
	currentBrands: text("current_brands"),
	annualVolume: varchar("annual_volume", { length: 100 }),
	message: text(),
	partnerAppStatus: mysqlEnum("partner_app_status", ['pending','contacted','approved','rejected']).default('pending').notNull(),
	createdAt: bigint("created_at", { mode: "number" }).notNull(),
	updatedAt: bigint("updated_at", { mode: "number" }),
});

export const pendingChargeSessions = mysqlTable("pending_charge_sessions", {
	id: int().autoincrement().notNull(),
	sessionId: varchar({ length: 64 }).notNull(),
	userId: int().notNull(),
	stationId: int().notNull(),
	connectorId: int().notNull(),
	ocppIdentity: varchar({ length: 128 }).notNull(),
	chargeMode: varchar({ length: 20 }).default('full_charge').notNull(),
	targetValue: decimal({ precision: 12, scale: 2 }).default('0').notNull(),
	estimatedCost: decimal({ precision: 12, scale: 2 }).default('0').notNull(),
	pricePerKwh: decimal({ precision: 10, scale: 2 }).default('1800').notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	expiresAt: timestamp({ mode: 'string' }).notNull(),
	consumed: tinyint().default(0).notNull(),
},
(table) => [
	index("pending_charge_sessions_sessionId_unique").on(table.sessionId),
]);

export const personalizedOffers = mysqlTable("personalized_offers", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	triggerRule: varchar({ length: 100 }).notNull(),
	discountPercent: int(),
	stationId: int(),
	validFrom: timestamp({ mode: 'string' }),
	validUntil: timestamp({ mode: 'string' }),
	title: varchar({ length: 200 }).notNull(),
	message: text().notNull(),
	offerStatus: mysqlEnum("offer_status", ['ACTIVE','REDEEMED','EXPIRED','DISMISSED']).default('ACTIVE').notNull(),
	redeemedAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
},
(table) => [
	index("idx_offers_user").on(table.userId),
	index("idx_offers_status").on(table.userId, table.offerStatus),
]);

export const platformPricingDefaults = mysqlTable("platform_pricing_defaults", {
	id: int().autoincrement().notNull(),
	orgPlan: mysqlEnum("org_plan", ['starter','professional','enterprise']).notNull(),
	setupFeePerCharger: decimal("setup_fee_per_charger", { precision: 10, scale: 2 }).notNull(),
	annualFeePerCharger: decimal("annual_fee_per_charger", { precision: 10, scale: 2 }).notNull(),
	transactionFeePercent: decimal("transaction_fee_percent", { precision: 5, scale: 2 }).notNull(),
	supportFeePercent: decimal("support_fee_percent", { precision: 5, scale: 2 }).notNull(),
	networkDiscount: decimal("network_discount", { precision: 5, scale: 2 }).default('1.00').notNull(),
	minMonthlyFeePerCharger: decimal("min_monthly_fee_per_charger", { precision: 10, scale: 2 }).notNull(),
	maxChargers: int("max_chargers").notNull(),
	roamingOwnerPercent: decimal("roaming_owner_percent", { precision: 5, scale: 2 }).default('80.00').notNull(),
	roamingPlatformPercent: decimal("roaming_platform_percent", { precision: 5, scale: 2 }).default('15.00').notNull(),
	roamingReferralPercent: decimal("roaming_referral_percent", { precision: 5, scale: 2 }).default('5.00').notNull(),
	uptimeSla: decimal("uptime_sla", { precision: 5, scale: 2 }).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
},
(table) => [
	index("idx_plan").on(table.orgPlan),
]);

export const platformSettings = mysqlTable("platform_settings", {
	id: int().autoincrement().notNull(),
	companyName: varchar({ length: 255 }).default('Green House Project'),
	businessLine: varchar({ length: 255 }).default('Green EV'),
	nit: varchar({ length: 50 }),
	contactEmail: varchar({ length: 255 }),
	investorPercentage: int().default(80).notNull(),
	platformFeePercentage: int().default(20).notNull(),
	wompiPublicKey: text(),
	wompiPrivateKey: text(),
	wompiIntegritySecret: text(),
	wompiEventsSecret: text(),
	wompiTestMode: tinyint().default(1).notNull(),
	enableEnergyBilling: tinyint().default(1).notNull(),
	enableReservationBilling: tinyint().default(1).notNull(),
	enableOccupancyPenalty: tinyint().default(1).notNull(),
	notifyChargeComplete: tinyint().default(1).notNull(),
	notifyReservationReminder: tinyint().default(1).notNull(),
	notifyPromotions: tinyint().default(0).notNull(),
	upmeEndpoint: text(),
	upmeToken: text(),
	upmeAutoReport: tinyint().default(1).notNull(),
	ocppPort: int().default(9000),
	ocppServerActive: tinyint().default(1).notNull(),
	updatedBy: int(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	minPricePerKwh: decimal({ precision: 10, scale: 2 }).default('400').notNull(),
	maxPricePerKwh: decimal({ precision: 10, scale: 2 }).default('2500').notNull(),
	enableDynamicPricing: tinyint().default(1).notNull(),
	defaultReservationFee: decimal({ precision: 10, scale: 2 }).default('5000').notNull(),
	defaultOverstayPenaltyPerMin: decimal({ precision: 10, scale: 2 }).default('500').notNull(),
	defaultConnectionFee: decimal({ precision: 10, scale: 2 }).default('2000').notNull(),
	defaultPricePerKwhAc: decimal("defaultPricePerKwhAC", { precision: 10, scale: 2 }).default('800').notNull(),
	defaultPricePerKwhDc: decimal("defaultPricePerKwhDC", { precision: 10, scale: 2 }).default('1200').notNull(),
	enableDifferentiatedPricing: tinyint().default(1).notNull(),
	factorUtilizacionPremium: decimal({ precision: 4, scale: 2 }).default('2.00').notNull(),
	costosOperativosIndividual: int().default(15).notNull(),
	costosOperativosColectivo: int().default(10).notNull(),
	costosOperativosAc: int("costosOperativosAC").default(15).notNull(),
	eficienciaCargaDc: int("eficienciaCargaDC").default(92).notNull(),
	eficienciaCargaAc: int("eficienciaCargaAC").default(95).notNull(),
	costoEnergiaRed: int().default(850).notNull(),
	costoEnergiaSolar: int().default(250).notNull(),
	precioVentaDefault: int().default(1800).notNull(),
	precioVentaMin: int().default(1400).notNull(),
	precioVentaMax: int().default(2200).notNull(),
	eventName: varchar({ length: 255 }).default('Gran Lanzamiento Red de Carga EVGreen'),
	eventDate: varchar({ length: 100 }).default('Por confirmar'),
	eventTime: varchar({ length: 100 }).default('Por confirmar'),
	eventVenueName: varchar({ length: 255 }).default('Por confirmar'),
	eventAddress: varchar({ length: 500 }).default('Bogotá, Colombia'),
	eventCity: varchar({ length: 100 }).default('Bogotá'),
	eventContactPhone: varchar({ length: 50 }),
	eventContactEmail: varchar({ length: 255 }).default('evgreen@greenhproject.com'),
	eventGoogleMapsUrl: text(),
	eventWazeUrl: text(),
	eventDressCode: varchar({ length: 100 }).default('Business Casual'),
	eventDescription: text(),
	eventMaxGuests: int().default(30),
	eventBgImageUrl: text(),
	defaultBasePricePerKwh: decimal({ precision: 10, scale: 2 }).default('1200').notNull(),
	defaultOverstayGracePeriodMinutes: int().default(10).notNull(),
	alegraEmail: varchar({ length: 255 }),
	alegraToken: text(),
	alegraEnabled: tinyint().default(0).notNull(),
	alegraTestMode: tinyint().default(1).notNull(),
	alegraDefaultItemId: varchar({ length: 50 }),
	alegraDefaultTaxId: varchar({ length: 50 }),
	alegraAutoInvoice: tinyint().default(1).notNull(),
	alegraPaymentMethodId: varchar({ length: 50 }),
	alegraPaymentAccountId: varchar({ length: 50 }),
	alegraResolutionNumber: varchar({ length: 100 }),
	supportEmail: varchar({ length: 255 }).default('soporte@greenhproject.com'),
	supportPhone: varchar({ length: 50 }).default('+573001234567'),
	supportAutoAssign: tinyint().default(1).notNull(),
	resendApiKey: text(),
	emailFrom: varchar({ length: 255 }).default('noreply@evgreen.lat'),
	resendWebhookSecretEncrypted: text("resend_webhook_secret_encrypted"),
	resendWebhookConfiguredAt: timestamp("resend_webhook_configured_at", { mode: 'string' }),
	whatsappPenaltyNotifIntervalMinutes: int().default(5).notNull(),
	// OCPI / CargaME-SIEM: secretos cifrados y configuración administrable.
	ocpiProvider: mysqlEnum("ocpi_provider", ['CARGAME']).default('CARGAME').notNull(),
	ocpiEnvironment: mysqlEnum("ocpi_environment", ['SANDBOX','PRODUCTION']).default('SANDBOX').notNull(),
	ocpiEnabled: tinyint("ocpi_enabled").default(0).notNull(),
	ocpiAutoSync: tinyint("ocpi_auto_sync").default(0).notNull(),
	ocpiVersionsUrl: text("ocpi_versions_url"),
	ocpiCountryCode: varchar("ocpi_country_code", { length: 2 }).default('CO'),
	ocpiPartyId: varchar("ocpi_party_id", { length: 3 }),
	ocpiModules: json("ocpi_modules"),
	ocpiTokenEncrypted: text("ocpi_token_encrypted"),
	ocpiInboundTokenEncrypted: text("ocpi_inbound_token_encrypted"),
	ocpiMtlsCertEncrypted: text("ocpi_mtls_cert_encrypted"),
	ocpiMtlsKeyEncrypted: text("ocpi_mtls_key_encrypted"),
	ocpiLastTestAt: timestamp("ocpi_last_test_at", { mode: 'string' }),
	ocpiLastTestStatus: mysqlEnum("ocpi_last_test_status", ['NEVER','SUCCESS','FAILED']).default('NEVER').notNull(),
	ocpiLastTestMessage: text("ocpi_last_test_message"),
});

export const priceHistory = mysqlTable("price_history", {
	id: int().autoincrement().notNull(),
	stationId: int().notNull(),
	evseId: int(),
	pricePerKwh: decimal({ precision: 10, scale: 2 }).notNull(),
	demandLevel: varchar({ length: 20 }).notNull(),
	occupancyRate: decimal({ precision: 5, scale: 2 }),
	timeMultiplier: decimal({ precision: 4, scale: 2 }),
	dayMultiplier: decimal({ precision: 4, scale: 2 }),
	finalMultiplier: decimal({ precision: 4, scale: 2 }),
	isAutoPricing: tinyint().default(1).notNull(),
	transactionId: int(),
	recordedAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const quoteItems = mysqlTable("quote_items", {
	id: int().autoincrement().notNull(),
	quoteId: int().notNull(),
	catalogItemId: int().notNull(),
	productName: varchar({ length: 255 }).notNull(),
	productPowerKw: decimal({ precision: 8, scale: 2 }).notNull(),
	productChargeType: varchar({ length: 10 }).notNull(),
	productConnector: varchar({ length: 50 }).notNull(),
	unitPrice: bigint({ mode: "number" }).notNull(),
	quantity: int().default(1).notNull(),
	lineTotal: bigint({ mode: "number" }).notNull(),
	includesTransformer: tinyint().default(0),
	cableMetersIncluded: int().default(10),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	productImageUrl: text(),
	commissionPercent: decimal({ precision: 5, scale: 2 }).default('0.00').notNull(),
	commissionAmount: bigint({ mode: "number" }).notNull(),
});

export const quoteSettings = mysqlTable("quote_settings", {
	id: int().autoincrement().notNull(),
	validityDays: int().default(30).notNull(),
	evgreenFeePercent: int().default(30).notNull(),
	ownerSharePercent: int().default(70).notNull(),
	companyName: varchar({ length: 255 }).default('EVGreen - Green House Project S.A.S').notNull(),
	companyNit: varchar({ length: 50 }).default('901.447.678-0').notNull(),
	companyPhone: varchar({ length: 50 }).default('321 456 7644').notNull(),
	companyEmail: varchar({ length: 255 }).default('evgreen@greenhproject.com').notNull(),
	companyWebsite: varchar({ length: 255 }).default('www.evgreen.lat').notNull(),
	headerMessage: text(),
	footerMessage: text(),
	termsAndConditions: text(),
	exclusions: text(),
	benefitsDescription: text(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	hostSharePercent: int().default(0).notNull(),
	defaultEnergyCostPerKwh: int().default(700).notNull(),
	defaultSalePricePerKwh: int().default(1800).notNull(),
	defaultDailyHours: decimal({ precision: 4, scale: 1 }).default('4.0').notNull(),
});

export const quotes = mysqlTable("quotes", {
	id: int().autoincrement().notNull(),
	quoteNumber: varchar({ length: 20 }).notNull(),
	clientName: varchar({ length: 255 }).notNull(),
	clientEmail: varchar({ length: 320 }).notNull(),
	clientPhone: varchar({ length: 50 }),
	clientCompany: varchar({ length: 255 }),
	clientCity: varchar({ length: 100 }),
	advisorId: int().notNull(),
	advisorName: varchar({ length: 255 }),
	quoteStatus: mysqlEnum("quote_status", ['DRAFT','SENT','VIEWED','ACCEPTED','REJECTED','EXPIRED']).default('DRAFT').notNull(),
	subtotal: bigint({ mode: "number" }).notNull(),
	discount: bigint({ mode: "number" }),
	total: bigint({ mode: "number" }).notNull(),
	validityDays: int().default(30).notNull(),
	expiresAt: timestamp({ mode: 'string' }),
	internalNotes: text(),
	clientNotes: text(),
	publicToken: varchar({ length: 64 }).notNull(),
	viewedAt: timestamp({ mode: 'string' }),
	viewCount: int().default(0),
	sentAt: timestamp({ mode: 'string' }),
	acceptedAt: timestamp({ mode: 'string' }),
	rejectedAt: timestamp({ mode: 'string' }),
	pdfUrl: text(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	evgreenSharePercent: decimal({ precision: 5, scale: 2 }).default('30.00'),
	investorSharePercent: decimal({ precision: 5, scale: 2 }).default('70.00'),
	hostSharePercent: decimal({ precision: 5, scale: 2 }).default('0.00'),
	projectionEnergyCostPerKwh: int().default(700),
	projectionSalePricePerKwh: int().default(1800),
	projectionDailyHours: decimal({ precision: 4, scale: 1 }).default('4.0'),
	projectionScenario: varchar({ length: 20 }).default('realistic'),
	showProjection: tinyint().default(1),
	totalCommission: bigint({ mode: "number" }),
},
(table) => [
	index("quotes_quoteNumber_unique").on(table.quoteNumber),
	index("quotes_publicToken_unique").on(table.publicToken),
]);

export const refunds = mysqlTable("refunds", {
	id: int().autoincrement().notNull(),
	transactionId: int().notNull(),
	userId: int().notNull(),
	adminId: int().notNull(),
	adminName: varchar({ length: 255 }).notNull(),
	amount: decimal({ precision: 12, scale: 2 }).notNull(),
	refundType: varchar({ length: 50 }).notNull(),
	reason: text().notNull(),
	claimId: int(),
	walletTransactionId: int(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const reservations = mysqlTable("reservations", {
	id: int().autoincrement().notNull(),
	evseId: int().notNull(),
	userId: int().notNull(),
	stationId: int().notNull(),
	startTime: timestamp({ mode: 'string' }).notNull(),
	endTime: timestamp({ mode: 'string' }).notNull(),
	expiryTime: timestamp({ mode: 'string' }).notNull(),
	reservationStatus: mysqlEnum("reservation_status", ['ACTIVE','EXPIRED','CANCELLED','FULFILLED','NO_SHOW']).default('ACTIVE').notNull(),
	reservationFee: decimal({ precision: 10, scale: 2 }).default('0'),
	noShowPenalty: decimal({ precision: 10, scale: 2 }).default('0'),
	isPenaltyApplied: tinyint().default(0).notNull(),
	transactionId: int(),
	ocppReservationId: int(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	reminder30MinSent: timestamp({ mode: 'string' }),
	reminder5MinSent: timestamp({ mode: 'string' }),
},
(table) => [
	index("idx_reservations_evse_status").on(table.evseId, table.reservationStatus),
]);

export const scheduledMaintenances = mysqlTable("scheduled_maintenances", {
	id: int().autoincrement().notNull(),
	stationId: int().notNull(),
	title: varchar({ length: 255 }).notNull(),
	description: text(),
	maintenanceType: varchar({ length: 100 }).notNull(),
	frequency: mysqlEnum(['weekly','biweekly','monthly','quarterly','semiannual','annual','one_time']).notNull(),
	nextDueDate: timestamp({ mode: 'string' }).notNull(),
	lastCompletedDate: timestamp({ mode: 'string' }),
	preferredTimeStart: varchar({ length: 5 }).default('08:00').notNull(),
	preferredTimeEnd: varchar({ length: 5 }).default('17:00').notNull(),
	assignedTechnicianId: int(),
	assignedEngineerId: int(),
	estimatedCostCop: bigint({ mode: "number" }),
	reminderDaysBefore: int().default(3).notNull(),
	reminderSent: tinyint().default(0).notNull(),
	status: mysqlEnum(['active','paused','completed','cancelled']).default('active').notNull(),
	notes: text(),
	createdBy: int().notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const sessionFeedback = mysqlTable("session_feedback", {
	id: int().autoincrement().notNull(),
	transactionId: int().notNull(),
	userId: int().notNull(),
	stationId: int(),
	rating: int().notNull(),
	comment: varchar({ length: 300 }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const settlementExpenseItems = mysqlTable("settlement_expense_items", {
	id: int().autoincrement().notNull(),
	settlementId: int().notNull(),
	expenseId: int(),
	name: varchar({ length: 255 }).notNull(),
	expenseCategory: mysqlEnum("expense_category", ['ENERGY','INSURANCE','CONNECTIVITY','MAINTENANCE','FIDUCIARY','TAX','CONTINGENCY','ADMIN','OTHER']).notNull(),
	originalAmount: bigint({ mode: "number" }).notNull(),
	proratedAmount: bigint({ mode: "number" }).notNull(),
	waterfallPriority: int().notNull(),
	isProrated: tinyint().default(0).notNull(),
	prorateFormula: varchar({ length: 255 }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const settlementExpenseLines = mysqlTable("settlement_expense_lines", {
	id: int().autoincrement().notNull(),
	settlementId: int().notNull(),
	fixedExpenseId: int(),
	name: varchar({ length: 255 }).notNull(),
	category: mysqlEnum(['insurance','connectivity','energy','maintenance','fiduciary','tax','admin','other']).default('other').notNull(),
	amount: decimal({ precision: 14, scale: 2 }).notNull(),
	waterfallOrder: int().default(0).notNull(),
	createdAt: bigint({ mode: "number" }).notNull(),
},
(table) => [
	index("idx_sel_settlement").on(table.settlementId),
]);

export const settlementPeriods = mysqlTable("settlement_periods", {
	id: int().autoincrement().notNull(),
	stationId: int().notNull(),
	periodType: mysqlEnum(['monthly','quarterly','semiannual','annual']).default('monthly').notNull(),
	periodLabel: varchar({ length: 50 }).notNull(),
	startDate: bigint({ mode: "number" }).notNull(),
	endDate: bigint({ mode: "number" }).notNull(),
	status: mysqlEnum(['open','calculating','closed','distributed','cancelled']).default('open').notNull(),
	grossRevenue: decimal({ precision: 14, scale: 2 }).default('0').notNull(),
	totalExpenses: decimal({ precision: 14, scale: 2 }).default('0').notNull(),
	netRevenue: decimal({ precision: 14, scale: 2 }).default('0').notNull(),
	platformFee: decimal({ precision: 14, scale: 2 }).default('0').notNull(),
	platformFeePercent: decimal({ precision: 5, scale: 2 }).default('30').notNull(),
	investorPool: decimal({ precision: 14, scale: 2 }).default('0').notNull(),
	investorPoolPercent: decimal({ precision: 5, scale: 2 }).default('70').notNull(),
	totalKwhSold: decimal({ precision: 12, scale: 4 }).default('0').notNull(),
	totalSessions: int().default(0).notNull(),
	avgPricePerKwh: decimal({ precision: 10, scale: 2 }).default('0').notNull(),
	notes: text(),
	closedAt: bigint({ mode: "number" }),
	closedBy: int(),
	createdAt: bigint({ mode: "number" }).notNull(),
	updatedAt: bigint({ mode: "number" }).notNull(),
	totalEnergyCost: decimal({ precision: 14, scale: 2 }).default('0.00').notNull(),
	energyCostPerKwh: decimal({ precision: 10, scale: 2 }).default('850.00'),
	revenueFromEnergy: decimal({ precision: 14, scale: 2 }).default('0.00').notNull(),
	revenueFromPenalties: decimal({ precision: 14, scale: 2 }).default('0.00').notNull(),
	revenueFromReservations: decimal({ precision: 14, scale: 2 }).default('0.00').notNull(),
	revenueFromAdvertising: decimal({ precision: 14, scale: 2 }).default('0.00').notNull(),
	hostSharePercent: decimal({ precision: 5, scale: 2 }).default('0.00').notNull(),
	hostPool: decimal({ precision: 14, scale: 2 }).default('0.00').notNull(),
	hostUserId: int(),
},
(table) => [
	index("idx_sp_station").on(table.stationId),
	index("idx_sp_status").on(table.status),
]);

export const socAccuracyLog = mysqlTable("soc_accuracy_log", {
	id: int().autoincrement().notNull(),
	userId: int().notNull().references(() => users.id, { onDelete: "cascade" } ),
	transactionId: int().notNull().references(() => transactions.id, { onDelete: "cascade" } ),
	vehicleId: int().references(() => userVehicles.id, { onDelete: "set null" } ),
	manualSocStart: int().notNull(),
	manualBatteryCapacityKwh: float().notNull(),
	realKwhDelivered: float().notNull(),
	calculatedSocEnd: int(),
	chargerSocEnd: int(),
	batteryFullDetected: tinyint().default(0).notNull(),
	detectionMethod: varchar({ length: 50 }),
	estimatedErrorKwh: float(),
	estimatedErrorSocPct: int(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const spacePhotos = mysqlTable("space_photos", {
	id: int().autoincrement().notNull(),
	submissionId: int().notNull(),
	photoUrl: text().notNull(),
	photoKey: varchar({ length: 500 }).notNull(),
	caption: varchar({ length: 255 }),
	photoType: mysqlEnum("photo_type", ['general','electrical_panel','transformer','parking_area','access_road','surroundings','other']).default('general').notNull(),
	sortOrder: int().default(0).notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const spaceSubmissions = mysqlTable("space_submissions", {
	id: int().autoincrement().notNull(),
	code: varchar({ length: 20 }).notNull(),
	submitterName: varchar({ length: 255 }).notNull(),
	submitterEmail: varchar({ length: 320 }).notNull(),
	submitterPhone: varchar({ length: 20 }).notNull(),
	submitterCompany: varchar({ length: 255 }),
	submitterDocument: varchar({ length: 50 }),
	spaceName: varchar({ length: 255 }).notNull(),
	spaceType: mysqlEnum("space_type", ['parking','mall','gas_station','hotel','restaurant','office_building','residential','supermarket','hospital','university','airport','highway_rest','other']).notNull(),
	spaceTypeOther: varchar({ length: 255 }),
	address: varchar({ length: 500 }).notNull(),
	city: varchar({ length: 100 }).notNull(),
	department: varchar({ length: 100 }),
	country: varchar({ length: 100 }).default('Colombia').notNull(),
	latitude: decimal({ precision: 10, scale: 8 }),
	longitude: decimal({ precision: 11, scale: 8 }),
	availableAreaM2: decimal({ precision: 10, scale: 2 }),
	parkingSpots: int(),
	transformerCapacityKva: decimal({ precision: 10, scale: 2 }),
	hasElectricalPanel: tinyint().default(0),
	electricalDistance: int(),
	hasInternet: tinyint().default(0),
	operatingHoursStart: varchar({ length: 5 }).default('06:00'),
	operatingHoursEnd: varchar({ length: 5 }).default('22:00'),
	is24Hours: tinyint().default(0),
	estimatedDailyVehicles: int(),
	estimatedEvPercent: int(),
	nearbyAttractions: text(),
	socioeconomicStratum: int(),
	additionalNotes: text(),
	spaceStatus: mysqlEnum("space_status", ['pending','under_review','approved','rejected','letter_sent','letter_accepted','published','funded','in_construction','operational']).default('pending').notNull(),
	technicalScore: int(),
	technicalNotes: text(),
	electricalViability: mysqlEnum("electrical_viability", ['viable','requires_upgrade','not_viable']),
	accessibilityScore: int(),
	trafficPotentialScore: int(),
	evaluatedBy: int(),
	evaluatedAt: timestamp({ mode: 'string' }),
	rejectionReason: text(),
	aiScore: int(),
	aiAnalysis: text(),
	aiScoredAt: timestamp({ mode: 'string' }),
	letterSentAt: timestamp({ mode: 'string' }),
	letterAcceptedAt: timestamp({ mode: 'string' }),
	letterToken: varchar({ length: 100 }),
	letterEmailId: varchar({ length: 120 }),
	letterDeliveryStatus: mysqlEnum("letter_delivery_status", ['SENT','DELIVERED','DELAYED','BOUNCED','FAILED','OPENED','CLICKED','COMPLAINED','SUPPRESSED']).default('SENT'),
	letterDeliveryUpdatedAt: timestamp({ mode: 'string' }),
	letterSignerName: varchar({ length: 255 }),
	letterSignerDocument: varchar({ length: 50 }),
	letterSignerIp: varchar({ length: 50 }),
	manualFormalizationReason: text("manual_formalization_reason"),
	manualFormalizationEvidence: text("manual_formalization_evidence"),
	manualFormalizedAt: timestamp("manual_formalized_at", { mode: 'string' }),
	manualFormalizedBy: int("manual_formalized_by"),
		crowdfundingProjectId: int(),
		estimatedInvestmentCop: bigint({ mode: "number" }),
		minimumInvestmentCop: bigint("minimum_investment_cop", { mode: "number" }),
		estimatedRoiPercent: decimal("estimated_roi_percent", { precision: 7, scale: 2 }),
		estimatedPaybackMonths: int("estimated_payback_months"),
		financialProjectionUpdatedAt: timestamp("financial_projection_updated_at", { mode: "string" }),
		financialProjectionUpdatedBy: int("financial_projection_updated_by"),
		estimatedPowerKw: int(),
	estimatedChargerCount: int(),
	recommendedChargerType: varchar({ length: 50 }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	viewCount: int().default(0).notNull(),
	signedLetterPdfUrl: text(),
	signedLetterPdfKey: varchar({ length: 500 }),
	letterSignerUserAgent: text(),
	investmentType: mysqlEnum("investment_type", ['individual','colectiva']).default('individual').notNull(),
	gestorId: int("gestor_id"),
	gestorCommissionPercent: decimal("gestor_commission_percent", { precision: 5, scale: 2 }).default('3.75').notNull(),
},
(table) => [
	index("space_submissions_code_unique").on(table.code),
	index("idx_space_letter_email_id").on(table.letterEmailId),
]);

/**
 * Bitácora inmutable de los movimientos del pipeline de cada espacio.
 * Conserva el estado anterior, el nuevo, el actor y la nota comercial o técnica
 * que justificó el avance. El actor puede ser nulo para eventos públicos como
 * la firma de la carta de intención.
 */
export const spaceStatusHistory = mysqlTable("space_status_history", {
	id: int().autoincrement().notNull(),
	submissionId: int("submission_id").notNull(),
	fromStatus: mysqlEnum("from_status", ['pending','under_review','approved','rejected','letter_sent','letter_accepted','published','funded','in_construction','operational']).notNull(),
	toStatus: mysqlEnum("to_status", ['pending','under_review','approved','rejected','letter_sent','letter_accepted','published','funded','in_construction','operational']).notNull(),
	changedById: int("changed_by_id"),
	changedByRole: varchar("changed_by_role", { length: 32 }),
	note: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
}, (table) => [
	index("idx_space_status_history_submission_created").on(table.submissionId, table.createdAt),
]);

export const letterEmailEvents = mysqlTable("letter_email_events", {
	id: int().autoincrement().notNull(),
	submissionId: int().notNull(),
	providerEventId: varchar({ length: 120 }).notNull(),
	providerEmailId: varchar({ length: 120 }).notNull(),
	eventType: varchar({ length: 60 }).notNull(),
	deliveryStatus: mysqlEnum("letter_email_delivery_status", ['SENT','DELIVERED','DELAYED','BOUNCED','FAILED','OPENED','CLICKED','COMPLAINED','SUPPRESSED']).notNull(),
	recipientEmail: varchar({ length: 320 }),
	occurredAt: timestamp({ mode: 'string' }).notNull(),
	receivedAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
}, (table) => [
	uniqueIndex("letter_email_events_provider_event_unique").on(table.providerEventId),
	index("idx_letter_email_events_submission").on(table.submissionId, table.occurredAt),
	index("idx_letter_email_events_email").on(table.providerEmailId),
]);

export const stationAvailabilityAlerts = mysqlTable("station_availability_alerts", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	stationId: int().notNull(),
	connectorType: varchar({ length: 30 }),
	stationName: varchar({ length: 200 }),
	userPhone: varchar({ length: 30 }),
	userName: varchar({ length: 100 }),
	sendPush: tinyint().default(1).notNull(),
	sendWhatsapp: tinyint().default(1).notNull(),
	alertReqStatus: mysqlEnum("alert_req_status", ['PENDING','SENT','CANCELLED','EXPIRED']).default('PENDING').notNull(),
	sentAt: timestamp({ mode: 'string' }),
	expiresAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
},
(table) => [
	index("idx_station_status").on(table.stationId, table.alertReqStatus),
	index("idx_user_status").on(table.userId, table.alertReqStatus),
]);

export const stationDemandForecast = mysqlTable("station_demand_forecast", {
	id: int().autoincrement().notNull(),
	stationId: int().notNull(),
	dayOfWeek: int().notNull(),
	hourOfDay: int().notNull(),
	avgSessionsPerSlot: decimal({ precision: 8, scale: 4 }).default('0'),
	avgOccupancyRate: decimal({ precision: 5, scale: 2 }).default('0'),
	avgKwhPerSlot: decimal({ precision: 10, scale: 4 }).default('0'),
	avgRevenuePerSlot: decimal({ precision: 12, scale: 2 }).default('0'),
	trend: varchar({ length: 20 }).default('STABLE'),
	trendPercent: decimal({ precision: 6, scale: 2 }).default('0'),
	suggestedDemandMultiplier: decimal({ precision: 4, scale: 3 }).default('1.000'),
	confidenceScore: int().default(0),
	sampleSize: int().default(0),
	lastCalculatedAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("unique_station_day_hour").on(table.stationId, table.dayOfWeek, table.hourOfDay),
	index("idx_station").on(table.stationId),
	index("idx_day_hour").on(table.dayOfWeek, table.hourOfDay),
]);

export const stationFixedExpenses = mysqlTable("station_fixed_expenses", {
	id: int().autoincrement().notNull(),
	stationId: int().notNull(),
	name: varchar({ length: 255 }).notNull(),
	expenseCategory: mysqlEnum("expense_category", ['ENERGY','INSURANCE','CONNECTIVITY','MAINTENANCE','FIDUCIARY','TAX','CONTINGENCY','ADMIN','OTHER']).notNull(),
	description: text(),
	amountCop: bigint({ mode: "number" }).notNull(),
	expensePeriodicity: mysqlEnum("expense_periodicity", ['MONTHLY','BIMONTHLY','QUARTERLY','SEMIANNUAL','ANNUAL','ONE_TIME']).notNull(),
	startDate: timestamp({ mode: 'string' }).notNull(),
	endDate: timestamp({ mode: 'string' }),
	providerName: varchar({ length: 255 }),
	contractReference: varchar({ length: 255 }),
	waterfallPriority: int().default(5).notNull(),
	isActive: tinyint().default(1).notNull(),
	createdBy: int().notNull(),
	updatedBy: int(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("idx_station").on(table.stationId),
]);

export const stationReviews = mysqlTable("station_reviews", {
	id: int().autoincrement().notNull(),
	stationId: int("station_id").notNull(),
	userId: int("user_id").notNull(),
	rating: int().notNull(),
	comment: text(),
	ownerResponse: text("owner_response"),
	ownerResponseAt: timestamp("owner_response_at", { mode: 'string' }),
	isApproved: tinyint("is_approved").default(1).notNull(),
	isVisible: tinyint("is_visible").default(1).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("idx_station_reviews_station").on(table.stationId),
	index("idx_station_reviews_user").on(table.userId),
]);

export const subscriptions = mysqlTable("subscriptions", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	subscriptionTier: mysqlEnum("subscription_tier", ['FREE','BASIC','PREMIUM','ENTERPRISE']).default('FREE').notNull(),
	discountPercentage: decimal({ precision: 5, scale: 2 }).default('0'),
	freeReservationsPerMonth: int().default(0),
	prioritySupport: tinyint().default(0),
	wompiPaymentSourceId: varchar({ length: 100 }),
	wompiCardToken: varchar({ length: 100 }),
	startDate: timestamp({ mode: 'string' }).notNull(),
	endDate: timestamp({ mode: 'string' }),
	nextBillingDate: timestamp({ mode: 'string' }),
	isActive: tinyint().default(1).notNull(),
	cancelledAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	cardBrand: varchar({ length: 20 }),
	cardLastFour: varchar({ length: 4 }),
	cardHolderName: varchar({ length: 255 }),
	monthlyAmountCents: bigint({ mode: "number" }),
	lastPaymentDate: timestamp({ mode: 'string' }),
	lastPaymentReference: varchar({ length: 255 }),
	failedPaymentCount: int().default(0),
	autoRechargeEnabled: tinyint().default(0).notNull(),
	autoRechargeThreshold: int().default(10000),
	autoRechargeAmount: int().default(20000),
	lastAutoRechargeAt: timestamp({ mode: 'string' }),
	autoRechargeFailCount: int().default(0),
	// Subscription lifecycle fields
	subscriptionStatus: mysqlEnum("subscription_status", ['ACTIVE','SUSPENDED','CANCELLED_PENDING','CANCELLED']).default('ACTIVE').notNull(),
	suspendedAt: timestamp({ mode: 'string' }),
	suspendedUntil: timestamp({ mode: 'string' }),
	cancellationRequestedAt: timestamp({ mode: 'string' }),
	cancellationEffectiveDate: timestamp({ mode: 'string' }),
	billingCronTaskUid: varchar({ length: 100 }),
	renewalReminderSentAt: timestamp({ mode: 'string' }),
});

export const supportAgents = mysqlTable("support_agents", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	isOnline: tinyint().default(0).notNull(),
	isAvailable: tinyint().default(1).notNull(),
	scheduleStart: varchar({ length: 10 }).default('08:00'),
	scheduleEnd: varchar({ length: 10 }).default('17:00'),
	workDays: json(),
	maxConcurrentTickets: int().default(5).notNull(),
	activeTicketCount: int().default(0).notNull(),
	lastAssignedAt: datetime({ mode: 'string'}),
	createdAt: datetime({ mode: 'string'}).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("unique_user").on(table.userId),
]);

export const supportMessages = mysqlTable("support_messages", {
	id: int().autoincrement().notNull(),
	ticketId: int().notNull(),
	senderId: int().default(0).notNull(),
	senderRole: varchar({ length: 20 }).default('user').notNull(),
	message: text().notNull(),
	attachmentUrl: varchar({ length: 500 }),
	readAt: datetime({ mode: 'string'}),
	createdAt: datetime({ mode: 'string'}).default('CURRENT_TIMESTAMP').notNull(),
	attachmentType: varchar({ length: 20 }),
	attachmentName: varchar({ length: 255 }),
});

export const supportTickets = mysqlTable("support_tickets", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	stationId: int(),
	transactionId: int(),
	subject: varchar({ length: 255 }).notNull(),
	description: text().notNull(),
	category: varchar({ length: 50 }),
	priority: varchar({ length: 20 }).default('MEDIUM'),
	status: varchar({ length: 20 }).default('OPEN'),
	assignedToId: int(),
	resolution: text(),
	resolvedAt: timestamp({ mode: 'string' }),
	attachments: json(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	rating: int(),
	ratingComment: text(),
	ratedAt: timestamp({ mode: 'string' }),
	organizationId: int("organization_id"),
});

export const tariffChangeLogs = mysqlTable("tariff_change_logs", {
	id: int().autoincrement().notNull(),
	tariffId: int(),
	stationId: int(),
	changedBy: int().notNull(),
	changedByName: varchar({ length: 255 }),
	changedByRole: varchar({ length: 50 }),
	tariffChangeType: mysqlEnum("tariff_change_type", ['CREATE','UPDATE','GLOBAL_UPDATE','DEACTIVATE']).notNull(),
	previousValues: json(),
	newValues: json(),
	description: text(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const tariffs = mysqlTable("tariffs", {
	id: int().autoincrement().notNull(),
	stationId: int().notNull(),
	name: varchar({ length: 100 }).notNull(),
	description: text(),
	pricePerKwh: decimal({ precision: 10, scale: 2 }).notNull(),
	pricePerMinute: decimal({ precision: 10, scale: 2 }).default('0'),
	pricePerSession: decimal({ precision: 10, scale: 2 }).default('0'),
	reservationFee: decimal({ precision: 10, scale: 2 }).default('0'),
	noShowPenalty: decimal({ precision: 10, scale: 2 }).default('0'),
	overstayPenaltyPerMinute: decimal({ precision: 10, scale: 2 }).default('0'),
	overstayGracePeriodMinutes: int().default(10),
	timeBasedPricing: json(),
	isActive: tinyint().default(1).notNull(),
	validFrom: timestamp({ mode: 'string' }),
	validTo: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	autoPricing: tinyint().default(0).notNull(),
	priceMinKwh: decimal({ precision: 10, scale: 2 }).default('1000'),
	priceMaxKwh: decimal({ precision: 10, scale: 2 }).default('3000'),
	connectionFee: decimal({ precision: 10, scale: 2 }).default('0'),
});

export const transactions = mysqlTable("transactions", {
	id: int().autoincrement().notNull(),
	evseId: int().notNull(),
	userId: int().notNull(),
	stationId: int().notNull(),
	tariffId: int(),
	ocppTransactionId: varchar({ length: 100 }),
	ocppNumericTxId: int(),
	startTime: timestamp({ mode: 'string' }).notNull(),
	endTime: timestamp({ mode: 'string' }),
	kwhConsumed: decimal({ precision: 10, scale: 4 }).default('0'),
	meterStart: decimal({ precision: 12, scale: 4 }),
	meterEnd: decimal({ precision: 12, scale: 4 }),
	energyCost: decimal({ precision: 12, scale: 2 }).default('0'),
	timeCost: decimal({ precision: 12, scale: 2 }).default('0'),
	sessionCost: decimal({ precision: 12, scale: 2 }).default('0'),
	overstayCost: decimal({ precision: 12, scale: 2 }).default('0'),
	totalCost: decimal({ precision: 12, scale: 2 }).default('0'),
	investorShare: decimal({ precision: 12, scale: 2 }).default('0'),
	platformFee: decimal({ precision: 12, scale: 2 }).default('0'),
	status: mysqlEnum("status", ['PENDING','IN_PROGRESS','COMPLETED','FAILED','CANCELLED']).default('PENDING').notNull(),
	transactionStatus: mysqlEnum("transaction_status", ['PENDING','IN_PROGRESS','COMPLETED','FAILED','CANCELLED']).default('PENDING').notNull(),
	startMethod: varchar({ length: 50 }),
	stopReason: varchar({ length: 100 }),
	reservationId: int(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	manualSoc: int(),
	manualSocEnd: int(),
	manualBatteryCapacityKwh: decimal({ precision: 6, scale: 2 }),
	chargeMode: varchar({ length: 20 }).default('full_charge'),
	targetValue: decimal({ precision: 12, scale: 2 }).default('0'),
	appliedPricePerKwh: decimal({ precision: 10, scale: 2 }),
});

export const userConsumptionProfile = mysqlTable("user_consumption_profile", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	totalSessions: int().default(0).notNull(),
	totalKwh: decimal({ precision: 12, scale: 4 }).default('0').notNull(),
	totalSpentCop: decimal({ precision: 15, scale: 2 }).default('0').notNull(),
	avgKwhPerSession: decimal({ precision: 8, scale: 4 }).default('0').notNull(),
	avgCostPerSession: decimal({ precision: 12, scale: 2 }).default('0').notNull(),
	avgSessionDurationMin: int().default(0).notNull(),
	monthlyAvgSpent: decimal({ precision: 12, scale: 2 }).default('0').notNull(),
	monthlyAvgKwh: decimal({ precision: 10, scale: 4 }).default('0').notNull(),
	monthlyAvgSessions: decimal({ precision: 6, scale: 2 }).default('0').notNull(),
	preferredHours: json(),
	preferredDays: json(),
	topStations: json(),
	preferredChargeType: varchar({ length: 10 }),
	preferredConnectorType: varchar({ length: 20 }),
	avgChargePowerKw: decimal({ precision: 8, scale: 2 }).default('0'),
	typicalChargeFrequencyDays: decimal({ precision: 6, scale: 2 }),
	lastChargeAt: timestamp({ mode: 'string' }),
	nextPredictedChargeAt: timestamp({ mode: 'string' }),
	userScore: int().default(0).notNull(),
	scoreBreakdown: json(),
	recommendedTier: varchar({ length: 20 }),
	estimatedMonthlySavingsWithUpgrade: decimal({ precision: 10, scale: 2 }).default('0'),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	hourlyDistribution: json(),
	weekdayDistribution: json(),
	peakHour: int(),
	peakWeekday: int(),
	sessionsPerWeek: decimal({ precision: 5, scale: 2 }),
	priceSensitivity: decimal({ precision: 4, scale: 3 }),
	avgPricePaidPerKwh: decimal({ precision: 10, scale: 2 }),
	sessionsAnalyzed: int().default(0).notNull(),
	windowDays: int().default(90).notNull(),
	profileConfidence: mysqlEnum("profile_confidence", ['LOW','MEDIUM','HIGH']).default('LOW').notNull(),
	computedAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP'),
},
(table) => [
	index("userId_unique").on(table.userId),
]);

export const userDataConsents = mysqlTable("user_data_consents", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	consentType: mysqlEnum("consent_type", ['AI_PROFILING','MARKETING','LOCATION_HISTORY']).notNull(),
	granted: tinyint().notNull(),
	policyVersion: varchar({ length: 20 }).notNull(),
	grantedAt: timestamp({ mode: 'string' }),
	revokedAt: timestamp({ mode: 'string' }),
	ipAddress: varchar({ length: 45 }),
	userAgent: varchar({ length: 512 }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("idx_consent_user").on(table.userId),
	index("idx_consent_type").on(table.userId, table.consentType),
]);

export const userOnboardingProgress = mysqlTable("user_onboarding_progress", {
	id: int().autoincrement().notNull(),
	userId: int("user_id").notNull(),
	version: varchar({ length: 30 }).default('2026-08-v1').notNull(),
	status: mysqlEnum("user_onboarding_status", ['IN_PROGRESS', 'COMPLETED', 'SKIPPED']).default('IN_PROGRESS').notNull(),
	currentStep: int("current_step").default(1).notNull(),
	startedAt: timestamp("started_at", { mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	lastSavedAt: timestamp("last_saved_at", { mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	skippedAt: timestamp("skipped_at", { mode: 'string' }),
},
(table) => [
	uniqueIndex("user_onboarding_progress_user_unique").on(table.userId),
]);

export const userOnboardingEvents = mysqlTable("user_onboarding_events", {
	id: int().autoincrement().notNull(),
	userId: int("user_id").notNull(),
	eventType: varchar("event_type", { length: 60 }).notNull(),
	granted: tinyint(),
	policyVersion: varchar("policy_version", { length: 30 }),
	ipAddress: varchar("ip_address", { length: 45 }),
	userAgent: varchar("user_agent", { length: 512 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
},
(table) => [
	index("user_onboarding_events_user_created_idx").on(table.userId, table.createdAt),
]);

export const userDebts = mysqlTable("user_debts", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	transactionId: int(),
	originalAmount: decimal({ precision: 12, scale: 2 }).notNull(),
	remainingAmount: decimal({ precision: 12, scale: 2 }).notNull(),
	reason: varchar({ length: 100 }).notNull(),
	description: text(),
	debtStatus: mysqlEnum("debt_status", ['PENDING','PAID','PARTIAL','WAIVED']).default('PENDING').notNull(),
	autoChargeAttempts: int().default(0).notNull(),
	lastAutoChargeAt: timestamp({ mode: 'string' }),
	paymentReference: varchar({ length: 255 }),
	paidAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const userLocationHistory = mysqlTable("user_location_history", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	latitude: decimal({ precision: 10, scale: 7 }).notNull(),
	longitude: decimal({ precision: 10, scale: 7 }).notNull(),
	accuracy: decimal({ precision: 8, scale: 2 }),
	source: varchar({ length: 50 }).default('chat'),
	address: varchar({ length: 500 }),
	city: varchar({ length: 100 }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const userLoginSessions = mysqlTable("user_login_sessions", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	userAgent: text(),
	ipAddress: varchar({ length: 45 }),
	deviceType: varchar({ length: 20 }),
	browser: varchar({ length: 100 }),
	os: varchar({ length: 100 }),
	location: varchar({ length: 255 }),
	isActive: tinyint().default(1).notNull(),
	loginAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	lastActivityAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	logoutAt: timestamp({ mode: 'string' }),
});

export const userRoutePatterns = mysqlTable("user_route_patterns", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	originLatitude: decimal({ precision: 10, scale: 7 }).notNull(),
	originLongitude: decimal({ precision: 10, scale: 7 }).notNull(),
	originName: varchar({ length: 200 }),
	originAddress: varchar({ length: 500 }),
	destinationLatitude: decimal({ precision: 10, scale: 7 }).notNull(),
	destinationLongitude: decimal({ precision: 10, scale: 7 }).notNull(),
	destinationName: varchar({ length: 200 }),
	destinationAddress: varchar({ length: 500 }),
	frequency: int().default(1).notNull(),
	estimatedDistanceKm: decimal({ precision: 8, scale: 2 }),
	averageDurationMinutes: int(),
	typicalDepartureHour: int(),
	typicalDays: json(),
	preferredChargingStops: json(),
	lastUsed: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const userVehicles = mysqlTable("user_vehicles", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	brand: varchar({ length: 100 }).notNull(),
	model: varchar({ length: 100 }).notNull(),
	year: int(),
	licensePlate: varchar({ length: 20 }),
	batteryCapacityKwh: decimal({ precision: 6, scale: 2 }),
	rangeKm: int(),
	connectorTypes: json().notNull(),
	maxChargePowerKw: decimal({ precision: 6, scale: 2 }),
	isDefault: tinyint().default(0).notNull(),
	isActive: tinyint().default(1).notNull(),
	imageUrl: text(),
	nickname: varchar({ length: 100 }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	batteryLevel: int(),
	lastBatteryUpdate: timestamp({ mode: 'string' }),
});

export const users = mysqlTable("users", {
	id: int().autoincrement().notNull(),
	openId: varchar({ length: 64 }).notNull(),
	name: text(),
	email: varchar({ length: 320 }),
	loginMethod: varchar({ length: 64 }),
	role: mysqlEnum(['staff','technician','investor','user','admin','engineer','host','comercial','advertiser']).default('user').notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	lastSignedIn: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	phone: varchar({ length: 20 }),
	avatarUrl: text(),
	isActive: tinyint().default(1).notNull(),
	companyName: varchar({ length: 255 }),
	taxId: varchar({ length: 50 }),
	bankAccount: varchar({ length: 100 }),
	bankName: varchar({ length: 100 }),
	technicianLicense: varchar({ length: 100 }),
	assignedRegion: varchar({ length: 100 }),
	idTag: varchar({ length: 20 }),
	fcmToken: text(),
	fcmTokenUpdatedAt: timestamp({ mode: 'string' }),
	notifyChargingComplete: tinyint().default(1),
	notifyLowBalance: tinyint().default(1),
	notifyPromotions: tinyint().default(1),
	notifyProximity: tinyint().default(1),
	proximityRadiusKm: int().default(5),
	lastProximityAlertAt: timestamp({ mode: 'string' }),
	lastProximityStationId: int(),
	prefLanguage: varchar({ length: 10 }).default('es'),
	prefDistanceUnit: varchar({ length: 5 }).default('km'),
	prefCurrency: varchar({ length: 5 }).default('COP'),
	prefAutoLocate: tinyint().default(1),
	prefSaveHistory: tinyint().default(1),
	prefShareUsageData: tinyint().default(0),
	techNotifyNewTickets: tinyint().default(1),
	techNotifyCriticalAlerts: tinyint().default(1),
	techNotifyMaintenanceReminders: tinyint().default(1),
	techNotifyByEmail: tinyint().default(1),
	techNotifyByPush: tinyint().default(1),
	techDefaultView: varchar({ length: 20 }).default('dashboard'),
	techAutoRefreshLogs: tinyint().default(1),
	techRefreshInterval: int().default(30),
	techAvailableForEmergencies: tinyint().default(1),
	techWorkingHoursStart: varchar({ length: 5 }).default('08:00'),
	techWorkingHoursEnd: varchar({ length: 5 }).default('18:00'),
	twoFactorEnabled: tinyint().default(0),
	twoFactorSecret: varchar({ length: 255 }),
	twoFactorVerifiedAt: timestamp({ mode: 'string' }),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	birthDate: date({ mode: 'string' }),
	address: varchar({ length: 500 }),
	city: varchar({ length: 100 }),
	investorType: mysqlEnum("investor_type", ['individual','collective','founder']),
	isFounder: tinyint().default(0).notNull(),
	founderTitle: varchar({ length: 100 }),
	founderOrder: int(),
	investorPhotoUrl: text(),
	investorQuote: varchar({ length: 500 }),
	investorBio: text(),
	investorBadge: varchar({ length: 50 }),
	investorJoinedAt: timestamp({ mode: 'string' }),
	investorTotalInvested: bigint({ mode: "number" }),
	investorShowInWall: tinyint().default(1).notNull(),
	pushSubscription: text(),
	documentType: mysqlEnum("document_type", ['CC','NIT','CE','PASAPORTE','TI','PEP']),
	documentNumber: varchar({ length: 50 }),
	fiscalAddress: varchar({ length: 500 }),
	fiscalCity: varchar({ length: 100 }),
	fiscalDepartment: varchar({ length: 100 }),
	kindOfPerson: mysqlEnum("kind_of_person", ['PERSON_ENTITY','LEGAL_ENTITY']),
	regime: mysqlEnum(['SIMPLIFIED_REGIME','COMMON_REGIME','NOT_RESPONSIBLE_FOR_IVA']),
	alegraContactId: varchar({ length: 50 }),
	electronicInvoiceOptIn: tinyint("electronic_invoice_opt_in").default(0).notNull(),
	investorTypes: json(),
	onboardingCompleted: tinyint().default(0),
	onboardingStep: int().default(0),
	onboardingStartedAt: timestamp({ mode: 'string' }),
	onboardingCompletedAt: timestamp({ mode: 'string' }),
	welcomeEmailSent: tinyint().default(0),
	orgId: int("org_id"),
	orgUserType: mysqlEnum("org_user_type", ['admin','viewer','end_user']),
	waNotifyChargeStart: tinyint().default(1).notNull(),
	waNotifyChargeEnd: tinyint().default(1).notNull(),
	waNotifyReminder: tinyint().default(0).notNull(),
	waNotifyPenalty: tinyint().default(1).notNull(),
	waNotifyWallet: tinyint().default(1).notNull(),
	termsAcceptedAt: timestamp({ mode: 'string' }),
	termsVersion: varchar({ length: 20 }).default('1.0'),
	emailNotifyEnabled: tinyint().default(1).notNull(),
	emailNotifyReceipts: tinyint().default(1).notNull(),
	emailNotifyWeeklyReport: tinyint().default(0).notNull(),
	emailNotifyPromotions: tinyint().default(0).notNull(),
},
(table) => [
	index("users_openId_unique").on(table.openId),
	index("users_email_unique").on(table.email),
	index("users_idTag_unique").on(table.idTag),
]);

export const vehicleProfiles = mysqlTable("vehicle_profiles", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	brand: varchar({ length: 100 }).notNull(),
	model: varchar({ length: 100 }).notNull(),
	year: int(),
	batteryCapacityKwh: decimal({ precision: 6, scale: 2 }),
	realRangeKm: int(),
	connectorType: varchar({ length: 30 }),
	chargeType: varchar({ length: 10 }),
	maxChargePowerKw: decimal({ precision: 6, scale: 2 }),
	color: varchar({ length: 50 }),
	licensePlate: varchar({ length: 20 }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("userId").on(table.userId),
]);

export const walletTransactions = mysqlTable("wallet_transactions", {
	id: int().autoincrement().notNull(),
	walletId: int().notNull(),
	userId: int().notNull(),
	type: varchar({ length: 50 }).notNull(),
	amount: decimal({ precision: 12, scale: 2 }).notNull(),
	balanceBefore: decimal({ precision: 12, scale: 2 }).notNull(),
	balanceAfter: decimal({ precision: 12, scale: 2 }).notNull(),
	referenceId: int(),
	referenceType: varchar({ length: 50 }),
	paymentStatus: mysqlEnum("payment_status", ['PENDING','COMPLETED','FAILED','REFUNDED']).default('PENDING').notNull(),
	description: text(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const wallets = mysqlTable("wallets", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	balance: decimal({ precision: 12, scale: 2 }).default('0').notNull(),
	currency: varchar({ length: 3 }).default('COP').notNull(),
	creditLimit: decimal({ precision: 12, scale: 2 }).default('0'),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("wallets_userId_unique").on(table.userId),
]);

export const whatsappConfig = mysqlTable("whatsapp_config", {
	id: int().autoincrement().notNull(),
	phoneNumberId: varchar({ length: 100 }),
	wabaId: varchar({ length: 100 }),
	accessToken: text(),
	appSecret: text(),
	verifyToken: varchar({ length: 255 }),
	displayPhone: varchar({ length: 30 }),
	enabled: tinyint().default(0).notNull(),
	notifyChargeStart: tinyint().default(1).notNull(),
	notifyChargeEnd: tinyint().default(1).notNull(),
	notifyChargeProgress: tinyint().default(0).notNull(),
	notifyPenalty: tinyint().default(1).notNull(),
	notifyWalletRecharge: tinyint().default(1).notNull(),
	notifyChargerOffline: tinyint().default(0).notNull(),
	notifyReservation: tinyint().default(1).notNull(),
	notifyMonthlySummary: tinyint().default(0).notNull(),
	updatedBy: int(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	adminPhone: varchar({ length: 30 }),
});

export const whatsappNotificationLog = mysqlTable("whatsapp_notification_log", {
	id: int().autoincrement().notNull(),
	userId: int(),
	toPhone: varchar({ length: 30 }).notNull(),
	eventType: varchar({ length: 50 }).notNull(),
	messageBody: text().notNull(),
	status: mysqlEnum(['sent','delivered','read','failed']).default('sent').notNull(),
	wamid: varchar({ length: 128 }),
	errorMessage: text(),
	referenceId: int(),
	referenceType: varchar({ length: 50 }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const wompiTransactions = mysqlTable("wompi_transactions", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	wompiTransactionId: varchar({ length: 255 }),
	reference: varchar({ length: 255 }).notNull(),
	amountInCents: bigint({ mode: "number" }).notNull(),
	currency: varchar({ length: 3 }).default('COP').notNull(),
	wompiTxStatus: mysqlEnum("wompi_tx_status", ['PENDING','APPROVED','DECLINED','VOIDED','ERROR']).default('PENDING').notNull(),
	wompiTxType: mysqlEnum("wompi_tx_type", ['WALLET_RECHARGE','SUBSCRIPTION','INVESTMENT_DEPOSIT','OTHER']).notNull(),
	paymentMethodType: varchar({ length: 50 }),
	customerEmail: varchar({ length: 320 }),
	description: text(),
	integritySignature: text(),
	processedAt: timestamp({ mode: 'string' }),
	webhookReceivedAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("wompiTransactionId").on(table.wompiTransactionId),
	index("reference").on(table.reference),
]);

// ============================================================================
// CHARGERS — physical charger units (level between station and connector)
// Each charger has its own OCPP identity and can have 1 or 2 connectors (evses)
// ============================================================================
export const chargers = mysqlTable("chargers", {
	id: int().autoincrement().notNull(),
	stationId: int("station_id").notNull(),
	ocppIdentity: varchar("ocpp_identity", { length: 100 }).notNull(),
	ocppPassword: varchar("ocpp_password", { length: 255 }),
	brand: varchar({ length: 100 }),
	model: varchar({ length: 100 }),
	serialNumber: varchar("serial_number", { length: 100 }),
	firmwareVersion: varchar("firmware_version", { length: 50 }),
	powerKw: decimal("power_kw", { precision: 8, scale: 2 }),
	chargerStatus: mysqlEnum("charger_status", ['ONLINE','OFFLINE','FAULTED','UNKNOWN']).default('UNKNOWN').notNull(),
	isOnline: tinyint("is_online").default(0).notNull(),
	isActive: tinyint("is_active").default(1).notNull(),
	lastHeartbeat: timestamp("last_heartbeat", { mode: 'string' }),
	lastBootNotification: timestamp("last_boot_notification", { mode: 'string' }),
	manufacturer: varchar({ length: 100 }),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("idx_chargers_station").on(table.stationId),
	index("idx_chargers_ocpp_identity").on(table.ocppIdentity),
]);

// ============================================================================
// EVSE STATE LOG — audit trail of all connector status transitions
// Single source of truth audit: every state change is recorded here
// ============================================================================
export const evseStateLog = mysqlTable("evse_state_log", {
	id: int().autoincrement().notNull(),
	evseId: int("evse_id").notNull(),
	stationId: int("station_id").notNull(),
	chargerId: int("charger_id"),
	previousStatus: varchar("previous_status", { length: 30 }),
	newStatus: varchar("new_status", { length: 30 }).notNull(),
	triggeredBy: mysqlEnum("triggered_by", ['OCPP','SYSTEM','ADMIN','BILLING','OVERSTAY','RESERVATION','SIMULATOR']).notNull(),
	reason: varchar({ length: 255 }),
	transactionId: int("transaction_id"),
	ocppMessageType: varchar("ocpp_message_type", { length: 50 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
},
(table) => [
	index("idx_evse_state_log_evse").on(table.evseId),
	index("idx_evse_state_log_station").on(table.stationId),
	index("idx_evse_state_log_created").on(table.createdAt),
]);

// ============================================================================
// INFERRED TYPES — generated from table definitions via Drizzle $inferInsert / $inferSelect
// These are the canonical type exports consumed by server/db.ts and routers.
// ============================================================================

// AI
export type InsertAIConfig = typeof aiConfig.$inferInsert;
export type AIConfig = typeof aiConfig.$inferSelect;
export type InsertAIConversation = typeof aiConversations.$inferInsert;
export type AIConversation = typeof aiConversations.$inferSelect;
export type InsertAIMessage = typeof aiMessages.$inferInsert;
export type AIMessage = typeof aiMessages.$inferSelect;
export type InsertAIUsage = typeof aiUsage.$inferInsert;
export type AIUsage = typeof aiUsage.$inferSelect;

// Banners
export type InsertBanner = typeof banners.$inferInsert;
export type Banner = typeof banners.$inferSelect;
export type InsertBannerView = typeof bannerViews.$inferInsert;
export type BannerView = typeof bannerViews.$inferSelect;

// Charger brands
export type InsertChargerBrand = typeof chargerBrands.$inferInsert;
export type ChargerBrand = typeof chargerBrands.$inferSelect;

// Charging stations
export type InsertChargingStation = typeof chargingStations.$inferInsert;
export type ChargingStation = typeof chargingStations.$inferSelect;

// Claims
export type InsertClaim = typeof claims.$inferInsert;
export type Claim = typeof claims.$inferSelect;

// EVSEs
export type InsertEvse = typeof evses.$inferInsert;
export type Evse = typeof evses.$inferSelect;

// Favorite stations
export type InsertFavoriteStation = typeof favoriteStations.$inferInsert;
export type FavoriteStation = typeof favoriteStations.$inferSelect;

// Financial settlements
export type InsertFinancialSettlement = typeof financialSettlements.$inferInsert;
export type FinancialSettlement = typeof financialSettlements.$inferSelect;

// ID Tags
export type InsertIdTag = typeof idTags.$inferInsert;
export type IdTag = typeof idTags.$inferSelect;

// Investor payouts
export type InsertInvestorPayout = typeof investorPayouts.$inferInsert;
export type InvestorPayout = typeof investorPayouts.$inferSelect;

// Investor settlement shares
export type InsertInvestorSettlementShare = typeof investorSettlementShares.$inferInsert;
export type InvestorSettlementShare = typeof investorSettlementShares.$inferSelect;

// Local auth
export type InsertLocalAuthEntry = typeof localAuthEntries.$inferInsert;
export type LocalAuthEntry = typeof localAuthEntries.$inferSelect;
export type InsertLocalAuthList = typeof localAuthLists.$inferInsert;
export type LocalAuthList = typeof localAuthLists.$inferSelect;

// Maintenance
export type InsertMaintenanceFundRecord = typeof maintenanceFundRecords.$inferInsert;
export type MaintenanceFundRecord = typeof maintenanceFundRecords.$inferSelect;
export type InsertMaintenanceTicket = typeof maintenanceTickets.$inferInsert;
export type MaintenanceTicket = typeof maintenanceTickets.$inferSelect;

// Meter values
export type InsertMeterValue = typeof meterValues.$inferInsert;
export type MeterValue = typeof meterValues.$inferSelect;

// Notifications
export type InsertNotification = typeof notifications.$inferInsert;
export type Notification = typeof notifications.$inferSelect;

// OCPP
export type InsertOcppAlert = typeof ocppAlerts.$inferInsert;
export type OcppAlert = typeof ocppAlerts.$inferSelect;
export type InsertOcppLog = typeof ocppLogs.$inferInsert;
export type OcppLog = typeof ocppLogs.$inferSelect;

// Offline transactions
export type InsertOfflineTransaction = typeof offlineTransactions.$inferInsert;
export type OfflineTransaction = typeof offlineTransactions.$inferSelect;

// Operational metrics
export type InsertOperationalMetric = typeof operationalMetrics.$inferInsert;
export type OperationalMetric = typeof operationalMetrics.$inferSelect;

// Platform settings
export type InsertPlatformSettings = typeof platformSettings.$inferInsert;
export type PlatformSettings = typeof platformSettings.$inferSelect;

// Price history
export type InsertPriceHistory = typeof priceHistory.$inferInsert;
export type PriceHistory = typeof priceHistory.$inferSelect;

// Refunds
export type InsertRefund = typeof refunds.$inferInsert;
export type Refund = typeof refunds.$inferSelect;

// Reservations
export type InsertReservation = typeof reservations.$inferInsert;
export type Reservation = typeof reservations.$inferSelect;

// Settlement expense items
export type InsertSettlementExpenseItem = typeof settlementExpenseItems.$inferInsert;
export type SettlementExpenseItem = typeof settlementExpenseItems.$inferSelect;

// Station fixed expenses
export type InsertStationFixedExpense = typeof stationFixedExpenses.$inferInsert;
export type StationFixedExpense = typeof stationFixedExpenses.$inferSelect;

// Station reviews
export type InsertStationReview = typeof stationReviews.$inferInsert;
export type StationReview = typeof stationReviews.$inferSelect;

// Support tickets
export type InsertSupportTicket = typeof supportTickets.$inferInsert;
export type SupportTicket = typeof supportTickets.$inferSelect;

// Tariffs
export type InsertTariff = typeof tariffs.$inferInsert;
export type Tariff = typeof tariffs.$inferSelect;
export type InsertTariffChangeLog = typeof tariffChangeLogs.$inferInsert;
export type TariffChangeLog = typeof tariffChangeLogs.$inferSelect;

// Transactions
export type InsertTransaction = typeof transactions.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;

// Users
export type InsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// User profiles
export type InsertUserConsumptionProfile = typeof userConsumptionProfile.$inferInsert;
export type UserConsumptionProfile = typeof userConsumptionProfile.$inferSelect;
export type InsertUserDebt = typeof userDebts.$inferInsert;
export type UserDebt = typeof userDebts.$inferSelect;
export type InsertUserLocationHistory = typeof userLocationHistory.$inferInsert;
export type UserLocationHistory = typeof userLocationHistory.$inferSelect;
export type InsertUserRoutePattern = typeof userRoutePatterns.$inferInsert;
export type UserRoutePattern = typeof userRoutePatterns.$inferSelect;
export type InsertUserVehicle = typeof userVehicles.$inferInsert;
export type UserVehicle = typeof userVehicles.$inferSelect;

// Wallets
export type InsertWallet = typeof wallets.$inferInsert;
export type Wallet = typeof wallets.$inferSelect;
export type InsertWalletTransaction = typeof walletTransactions.$inferInsert;
export type WalletTransaction = typeof walletTransactions.$inferSelect;

// Wompi
export type InsertWompiTransaction = typeof wompiTransactions.$inferInsert;
export type WompiTransaction = typeof wompiTransactions.$inferSelect;

// Support (additional)
export type InsertSupportMessage = typeof supportMessages.$inferInsert;
export type SupportMessage = typeof supportMessages.$inferSelect;
export type InsertSupportAgent = typeof supportAgents.$inferInsert;
export type SupportAgent = typeof supportAgents.$inferSelect;
// Chargers
export type InsertCharger = typeof chargers.$inferInsert;
export type Charger = typeof chargers.$inferSelect;
// EVSE State Log
export type InsertEvseStateLog = typeof evseStateLog.$inferInsert;
export type EvseStateLog = typeof evseStateLog.$inferSelect;

// ─── Portal de Anunciantes ────────────────────────────────────────────────────

export const advertiserProfiles = mysqlTable("advertiser_profiles", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	companyName: varchar({ length: 255 }).notNull(),
	taxId: varchar({ length: 50 }),
	industry: varchar({ length: 100 }),
	website: varchar({ length: 255 }),
	contactName: varchar({ length: 255 }),
	contactPhone: varchar({ length: 30 }),
	contactEmail: varchar({ length: 320 }),
	monthlyBudget: int(),
	status: mysqlEnum(['pending','approved','rejected','suspended']).default('pending').notNull(),
	adminNotes: text(),
	approvedAt: timestamp({ mode: 'string' }),
	approvedById: int(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

/** Bitácora inmutable de decisiones administrativas sobre perfiles de anunciantes. */
export const advertiserProfileReviewEvents = mysqlTable("advertiser_profile_review_events", {
	id: int().autoincrement().notNull(),
	profileId: int().notNull(),
	action: mysqlEnum(['approved', 'rejected', 'suspended']).notNull(),
	notes: text(),
	actorId: int().notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const adCampaigns = mysqlTable("ad_campaigns", {
	id: int().autoincrement().notNull(),
	advertiserId: int().notNull(),
	name: varchar({ length: 255 }).notNull(),
	objective: mysqlEnum(['awareness','traffic','conversions','app_install']).default('awareness').notNull(),
	status: mysqlEnum(['draft','pending_review','approved','active','paused','completed','rejected']).default('draft').notNull(),
	budgetTotal: int().notNull(),
	budgetSpent: int().default(0).notNull(),
	startDate: timestamp({ mode: 'string' }),
	endDate: timestamp({ mode: 'string' }),
	targetCities: json(),
	targetVehicleBrands: json(),
	targetSubscriptionTiers: json(),
	targetMinChargesPerMonth: int(),
	targetActivitySegments: json(),
	impressions: int().default(0).notNull(),
	clicks: int().default(0).notNull(),
	uniqueViews: int().default(0).notNull(),
	adminNotes: text(),
	reviewedById: int(),
	reviewedAt: timestamp({ mode: 'string' }),
	aiSuggestions: json(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const adCampaignCreatives = mysqlTable("ad_campaign_creatives", {
	id: int().autoincrement().notNull(),
	campaignId: int().notNull(),
	format: mysqlEnum(['SPLASH','CHARGING','MAP','PROMOTIONAL']).default('PROMOTIONAL').notNull(),
	imageUrl: text().notNull(),
	imageUrlMobile: text(),
	title: varchar({ length: 255 }).notNull(),
	subtitle: varchar({ length: 500 }),
	body: text(),
	ctaText: varchar({ length: 100 }),
	linkUrl: text(),
	status: mysqlEnum(['draft','pending_review','approved','rejected']).default('draft').notNull(),
	adminNotes: text(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

// Types — Portal de Anunciantes
export type InsertAdvertiserProfile = typeof advertiserProfiles.$inferInsert;
export type AdvertiserProfile = typeof advertiserProfiles.$inferSelect;
export type InsertAdvertiserProfileReviewEvent = typeof advertiserProfileReviewEvents.$inferInsert;
export type AdvertiserProfileReviewEvent = typeof advertiserProfileReviewEvents.$inferSelect;
export type InsertAdCampaign = typeof adCampaigns.$inferInsert;
export type AdCampaign = typeof adCampaigns.$inferSelect;
export type InsertAdCampaignCreative = typeof adCampaignCreatives.$inferInsert;
export type AdCampaignCreative = typeof adCampaignCreatives.$inferSelect;
