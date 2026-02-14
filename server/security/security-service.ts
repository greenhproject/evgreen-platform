/**
 * Servicio de Seguridad
 * 
 * Maneja:
 * - Autenticación de dos factores (2FA) con TOTP (speakeasy)
 * - Historial y gestión de sesiones de login
 * - Parsing de User-Agent para información del dispositivo
 */

import speakeasy from "speakeasy";
import { getDb } from "../db";
import { users, userLoginSessions } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

// ============================================================================
// 2FA - TOTP (Time-based One-Time Password)
// ============================================================================

/**
 * Genera un nuevo secreto TOTP para el usuario
 * Retorna el secreto y la URL otpauth para generar QR en el frontend
 */
export async function generate2FASecret(userId: number, userEmail: string): Promise<{
  secret: string;
  otpauthUrl: string;
}> {
  const secretObj = speakeasy.generateSecret({
    name: `EVGreen:${userEmail}`,
    issuer: "EVGreen",
    length: 32,
  });
  
  const secret = secretObj.base32;
  const otpauthUrl = secretObj.otpauth_url || "";
  
  // Guardar el secreto temporalmente (no verificado aún)
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  
  await database.update(users).set({
    twoFactorSecret: secret,
    twoFactorEnabled: false, // No habilitar hasta verificar
  }).where(eq(users.id, userId));
  
  return { secret, otpauthUrl };
}

/**
 * Verifica un código TOTP y habilita 2FA si es correcto
 */
export async function verify2FAToken(userId: number, token: string): Promise<boolean> {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  
  const [user] = await database
    .select({
      twoFactorSecret: users.twoFactorSecret,
      twoFactorEnabled: users.twoFactorEnabled,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  
  if (!user?.twoFactorSecret) return false;
  
  const isValid = speakeasy.totp.verify({
    secret: user.twoFactorSecret,
    encoding: "base32",
    token,
    window: 1, // Permitir 1 intervalo de tolerancia (30s)
  });
  
  if (isValid && !user.twoFactorEnabled) {
    // Habilitar 2FA al verificar por primera vez
    await database.update(users).set({
      twoFactorEnabled: true,
      twoFactorVerifiedAt: new Date(),
    }).where(eq(users.id, userId));
  }
  
  return isValid;
}

/**
 * Desactiva 2FA para un usuario (requiere código válido para confirmar)
 */
export async function disable2FA(userId: number, token: string): Promise<boolean> {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  
  // Verificar el token antes de desactivar
  const [user] = await database
    .select({ twoFactorSecret: users.twoFactorSecret })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  
  if (!user?.twoFactorSecret) return false;
  
  const isValid = speakeasy.totp.verify({
    secret: user.twoFactorSecret,
    encoding: "base32",
    token,
    window: 1,
  });
  
  if (!isValid) return false;
  
  await database.update(users).set({
    twoFactorEnabled: false,
    twoFactorSecret: null,
    twoFactorVerifiedAt: null,
  }).where(eq(users.id, userId));
  
  return true;
}

/**
 * Obtiene el estado de 2FA de un usuario
 */
export async function get2FAStatus(userId: number): Promise<{
  enabled: boolean;
  verifiedAt: Date | null;
}> {
  const database = await getDb();
  if (!database) return { enabled: false, verifiedAt: null };
  
  const [user] = await database
    .select({
      twoFactorEnabled: users.twoFactorEnabled,
      twoFactorVerifiedAt: users.twoFactorVerifiedAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  
  return {
    enabled: user?.twoFactorEnabled ?? false,
    verifiedAt: user?.twoFactorVerifiedAt ?? null,
  };
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Parsea un User-Agent string para extraer información del dispositivo
 */
export function parseUserAgent(ua: string | undefined): {
  deviceType: string;
  browser: string;
  os: string;
} {
  if (!ua) return { deviceType: "desconocido", browser: "Desconocido", os: "Desconocido" };
  
  // Detectar tipo de dispositivo
  let deviceType = "desktop";
  if (/Mobile|Android|iPhone|iPad|iPod/i.test(ua)) {
    deviceType = /iPad|Tablet/i.test(ua) ? "tablet" : "mobile";
  }
  
  // Detectar navegador
  let browser = "Desconocido";
  if (/Edg\//i.test(ua)) browser = "Microsoft Edge";
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = "Google Chrome";
  else if (/Firefox\//i.test(ua)) browser = "Mozilla Firefox";
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";
  else if (/Opera|OPR\//i.test(ua)) browser = "Opera";
  
  // Extraer versión del navegador
  const versionMatch = ua.match(/(Chrome|Firefox|Safari|Edg|OPR)\/(\d+)/);
  if (versionMatch) {
    browser += ` ${versionMatch[2]}`;
  }
  
  // Detectar SO (iOS antes de macOS porque iPhone UA contiene "Mac OS X")
  let os = "Desconocido";
  if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Android (\d+)/i.test(ua)) {
    const m = ua.match(/Android (\d+)/i);
    os = `Android ${m?.[1] || ""}`;
  }
  else if (/Windows NT 10/i.test(ua)) os = "Windows 10/11";
  else if (/Windows/i.test(ua)) os = "Windows";
  else if (/Mac OS X/i.test(ua)) os = "macOS";
  else if (/Linux/i.test(ua)) os = "Linux";
  
  return { deviceType, browser, os };
}

/**
 * Registra una nueva sesión de login
 */
export async function recordLoginSession(
  userId: number,
  userAgent?: string,
  ipAddress?: string
): Promise<number | null> {
  const database = await getDb();
  if (!database) return null;
  
  const { deviceType, browser, os } = parseUserAgent(userAgent);
  
  try {
    const result = await database.insert(userLoginSessions).values({
      userId,
      userAgent: userAgent || null,
      ipAddress: ipAddress || null,
      deviceType,
      browser,
      os,
      isActive: true,
      loginAt: new Date(),
      lastActivityAt: new Date(),
    });
    
    return (result as any)[0]?.insertId || null;
  } catch (error) {
    console.error("[Security] Error recording login session:", error);
    return null;
  }
}

/**
 * Obtiene las sesiones de un usuario (activas e inactivas)
 */
export async function getUserSessions(userId: number, limit: number = 20): Promise<{
  id: number;
  deviceType: string | null;
  browser: string | null;
  os: string | null;
  ipAddress: string | null;
  location: string | null;
  isActive: boolean;
  loginAt: Date;
  lastActivityAt: Date;
  logoutAt: Date | null;
}[]> {
  const database = await getDb();
  if (!database) return [];
  
  const sessions = await database
    .select({
      id: userLoginSessions.id,
      deviceType: userLoginSessions.deviceType,
      browser: userLoginSessions.browser,
      os: userLoginSessions.os,
      ipAddress: userLoginSessions.ipAddress,
      location: userLoginSessions.location,
      isActive: userLoginSessions.isActive,
      loginAt: userLoginSessions.loginAt,
      lastActivityAt: userLoginSessions.lastActivityAt,
      logoutAt: userLoginSessions.logoutAt,
    })
    .from(userLoginSessions)
    .where(eq(userLoginSessions.userId, userId))
    .orderBy(desc(userLoginSessions.loginAt))
    .limit(limit);
  
  return sessions;
}

/**
 * Cierra una sesión específica
 */
export async function terminateSession(userId: number, sessionId: number): Promise<boolean> {
  const database = await getDb();
  if (!database) return false;
  
  await database.update(userLoginSessions).set({
    isActive: false,
    logoutAt: new Date(),
  }).where(
    and(
      eq(userLoginSessions.id, sessionId),
      eq(userLoginSessions.userId, userId)
    )
  );
  
  return true;
}

/**
 * Cierra todas las sesiones de un usuario excepto la actual
 */
export async function terminateAllOtherSessions(
  userId: number,
  currentSessionId?: number
): Promise<number> {
  const database = await getDb();
  if (!database) return 0;
  
  const activeSessions = await database
    .select({ id: userLoginSessions.id })
    .from(userLoginSessions)
    .where(
      and(
        eq(userLoginSessions.userId, userId),
        eq(userLoginSessions.isActive, true)
      )
    );
  
  let terminated = 0;
  for (const session of activeSessions) {
    if (session.id !== currentSessionId) {
      await database.update(userLoginSessions).set({
        isActive: false,
        logoutAt: new Date(),
      }).where(eq(userLoginSessions.id, session.id));
      terminated++;
    }
  }
  
  return terminated;
}

/**
 * Actualiza la última actividad de una sesión
 */
export async function updateSessionActivity(sessionId: number): Promise<void> {
  const database = await getDb();
  if (!database) return;
  
  await database.update(userLoginSessions).set({
    lastActivityAt: new Date(),
  }).where(eq(userLoginSessions.id, sessionId));
}
