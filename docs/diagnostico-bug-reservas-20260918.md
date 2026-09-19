# Diagnóstico y Corrección — Bug de Reservas EVGreen (2026-09-18)

## 1. Problema Reportado
"tenemos un problema al reservar, el sistema cuando llega la hora, se desaparece del sistema y cuando llega al usuario, no aparece en pendientes"

## 2. Causas Raíz Identificadas

### Causa A: Comparación de fechas lexicográfica inválida en `server/db.ts`
En `db.getEvsesByStationId` (línea 848) y `db.getAllEvsesForStations` (línea 930):
```ts
const currentOrImminent = activeResList.find(r => 
  r.startTime <= in15Min.toISOString() && r.endTime > now.toISOString()
);
```
- `r.endTime` en MySQL es un string con espacio: `"2026-09-19 03:43:00"`.
- `now.toISOString()` es un string ISO con 'T': `"2026-09-19T02:49:41.000Z"`.
- En ASCII, el espacio `' '` (32) NUNCA es mayor que `'T'` (84).
- Por lo tanto `r.endTime > now.toISOString()` evalúa a `false` SIEMPRE.
- Consecuencia: Cuando "llega la hora", el conector NUNCA se asocia como reserva activa/inminente, `activeReservationUserId` se entrega como `null`, y el conector desaparece como reservado.

### Causa B: Incompatibilidad de nombres de propiedad `status` vs `reservationStatus`
En `client/src/pages/user/Map.tsx` (línea 179):
```ts
if (r.status !== 'ACTIVE') return false;
```
La tabla MySQL y el router devuelven `reservationStatus: "ACTIVE"`. `r.status` es `undefined`.
Por tanto `r.status !== 'ACTIVE'` evalúa a `true` SIEMPRE, y el banner de reserva activa en el mapa NUNCA aparece.
En el backend y frontend se debe normalizar para que ambos campos (`status` y `reservationStatus`) estén presentes y sincronizados.

### Causa C: Expiración prematura y agresiva en `processNoShows` (15 min)
En `server/notifications/reservation-notifications.ts` (línea 240):
`gracePeriodMinutes = 15;`
`lte(reservations.startTime, graceExpired);`
A los 15 minutos exactos del `startTime`, `processNoShows` marca la reserva como `NO_SHOW`, cobra penalización y la expira.
Si el usuario reserva para cargar durante una franja (ej. 1 hora) o se retrasa unos minutos en llegar a la estación, a los 15 minutos exactos la reserva pasa a `NO_SHOW`, sale de "Próximas reservas", desaparece de pendientes y cuando el usuario llega ya no puede hacer check-in ni usar su reserva.
Además, la expiración debe considerar el `endTime` o permitir la ventana completa de la reserva mientras esté vigente, o un período de gracia configurable y nunca antes de que el usuario haya tenido su ventana.

### Causa D: StartCharge check-in y visualización de pendientes
En `client/src/pages/user/Reservations.tsx`:
Las reservas solo se mostraban bajo "Próximas reservas" si `reservationStatus === "ACTIVE"`.
Cuando una reserva está "En curso" (ya empezó pero aún no termina), debe tener una sección destacada "Reservas en curso / Pendientes de uso" para que el usuario al llegar la vea de inmediato con botón directo de "Iniciar carga / Conectar".
En `StationDetail.tsx` y `StartCharge.tsx`, `userActiveReservation` debe aceptar reservas activas en curso y validar `new Date(r.startTime) <= now && new Date(r.endTime) >= now`.
