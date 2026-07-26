import { relations } from "drizzle-orm/relations";
import { users, socAccuracyLog, transactions, userVehicles } from "./schema";

export const socAccuracyLogRelations = relations(socAccuracyLog, ({one}) => ({
	user: one(users, {
		fields: [socAccuracyLog.userId],
		references: [users.id]
	}),
	transaction: one(transactions, {
		fields: [socAccuracyLog.transactionId],
		references: [transactions.id]
	}),
	userVehicle: one(userVehicles, {
		fields: [socAccuracyLog.vehicleId],
		references: [userVehicles.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	socAccuracyLogs: many(socAccuracyLog),
}));

export const transactionsRelations = relations(transactions, ({many}) => ({
	socAccuracyLogs: many(socAccuracyLog),
}));

export const userVehiclesRelations = relations(userVehicles, ({many}) => ({
	socAccuracyLogs: many(socAccuracyLog),
}));