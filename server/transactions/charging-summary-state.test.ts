import { describe, expect, it } from 'vitest';
import { getChargingSummaryIssue, parseChargingTransactionId } from '../../shared/charging-summary-state';

describe('Enlace y errores del resumen de carga', () => {
  it('acepta únicamente IDs completos, enteros positivos y seguros', () => {
    expect(parseChargingTransactionId('1170006')).toBe(1170006);
    for (const input of [undefined, '', '0', '-1', '1.5', '1170006abc', '1e3', 'Infinity', '9007199254740993']) {
      expect(parseChargingTransactionId(input)).toBeNull();
    }
  });
  it('sólo presenta no encontrada ante un NOT_FOUND auténtico', () => {
    expect(getChargingSummaryIssue('NOT_FOUND').title).toBe('Transacción no encontrada');
    for (const code of [undefined, 'INTERNAL_SERVER_ERROR', 'TIMEOUT', 'SERVICE_UNAVAILABLE']) {
      const issue = getChargingSummaryIssue(code);
      expect(issue.title).toBe('No pudimos cargar el resumen');
      expect(issue.message).toContain('no inicia otro cobro');
      expect(issue.retryable).toBe(true);
    }
  });
  it('no reintenta errores permanentes ni oculta problemas de autorización', () => {
    expect(getChargingSummaryIssue('FORBIDDEN')).toMatchObject({ title: 'Sin acceso a esta transacción', retryable: false });
    expect(getChargingSummaryIssue('UNAUTHORIZED')).toMatchObject({ title: 'Necesitas iniciar sesión', retryable: false });
    expect(getChargingSummaryIssue(undefined, false).title).toBe('Necesitas iniciar sesión');
    expect(getChargingSummaryIssue('BAD_REQUEST')).toMatchObject({ title: 'Enlace de carga inválido', retryable: false });
    expect(getChargingSummaryIssue('NOT_FOUND').retryable).toBe(false);
  });
});
