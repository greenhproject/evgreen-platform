import type { NotificationType } from "../firebase/fcm";

/**
 * Preferencias del perfil que pueden suprimir mensajes no críticos. Valores
 * ausentes conservan el comportamiento histórico de permitir la notificación.
 */
export interface UserPushNotificationPreferences {
  notifyChargingComplete?: boolean | number | null;
  notifyLowBalance?: boolean | number | null;
  notifyPromotions?: boolean | number | null;
}

function isEnabled(value: boolean | number | null | undefined): boolean {
  return value === undefined || value === null || value === true || value === 1;
}

/**
 * Aplica una única política para cada emisor que usa `sendUserPush`.
 * Las alertas de seguridad y pagos no configurables permanecen habilitadas:
 * el interruptor de saldo bajo sólo suprime `low_balance`, no un auto-stop
 * confirmado ni un fallo de cobro.
 */
export function isPushNotificationAllowed(
  preferences: UserPushNotificationPreferences,
  notificationType: NotificationType,
): boolean {
  switch (notificationType) {
    case "charging_complete":
      return isEnabled(preferences.notifyChargingComplete);
    case "low_balance":
      return isEnabled(preferences.notifyLowBalance);
    case "promotion":
      return isEnabled(preferences.notifyPromotions);
    default:
      return true;
  }
}
