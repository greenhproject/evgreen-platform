export function parseChargingTransactionId(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function getChargingSummaryIssue(code?: string, authenticated = true) {
  if (!authenticated || code === 'UNAUTHORIZED') {
    return { title: 'Necesitas iniciar sesión', message: 'Vuelve a ingresar a tu cuenta para consultar el resumen de tu carga.', retryable: false };
  }
  if (code === 'FORBIDDEN') {
    return { title: 'Sin acceso a esta transacción', message: 'Este resumen sólo está disponible para la cuenta autorizada.', retryable: false };
  }
  if (code === 'NOT_FOUND') {
    return { title: 'Transacción no encontrada', message: 'No encontramos una transacción con este identificador. Puedes revisar tu historial de cargas.', retryable: false };
  }
  if (code === 'BAD_REQUEST') {
    return { title: 'Enlace de carga inválido', message: 'El enlace no contiene un identificador válido. Abre el resumen desde tu historial de cargas.', retryable: false };
  }
  return { title: 'No pudimos cargar el resumen', message: 'No fue posible consultar el servidor. Esto no significa que la transacción se haya perdido. Reintenta la consulta; no inicia otro cobro.', retryable: true };
}
