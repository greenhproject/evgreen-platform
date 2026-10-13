# Certificación: Badge del ícono sincronizado con el conteo real de no leídas

## Resumen ejecutivo

**Qué estaba roto:** el badge numérico del ícono de la app no reflejaba el conteo real de notificaciones sin leer. Abrir la app limpiaba el badge a 0 sin importar cuántas notificaciones seguían pendientes, y marcar una sola notificación como leída no bajaba el número — el usuario veía un "5" pegado en el ícono aunque ya hubiera leído varias.

**Qué se corrigió:** el ícono ahora refleja siempre el conteo real de no leídas consultado al servidor (`notifications.unreadCount`), siguiendo la convención de la industria (Braze, OneSignal) para badges de tipo "bandeja de pendientes": el servidor es la única fuente de verdad, el número baja según lo que de verdad sigue sin leer.

**Cómo se probó:** no solo revisando el código — se instaló la app real en un iOS Simulator, con la cuenta QA dedicada (`qa-automation@evgreen.lat`), y se ejecutaron 6 escenarios reales end-to-end, cada uno verificado contra el conteo real en base de datos (no solo contra lo que se veía en pantalla). Esa prueba real encontró 2 bugs genuinos que la sola lectura del código no mostraba — ver sección "Bugs encontrados y corregidos" abajo.

---

## Escenarios probados (evidencia en `Entregables_Octubre_2026/capturas/badge-counter-sync/`)

| # | Escenario | Esperado | Observado | Evidencia | Resultado |
|---|---|---|---|---|---|
| 1 | 1 notificación sin leer, reapertura de la app | Badge = 1 | Badge = 1, coincide con conteo real en BD | `01-una-no-leida-badge-1.jpg` | ✅ |
| 2 | 3 notificaciones sin leer | Badge = 3 | Badge = 3, coincide con BD | `02-tres-no-leidas-badge-3.jpg` | ✅ |
| 3 | Marcar 1 sola como leída desde el panel real de la app | Badge baja a 2 | Badge baja a 2 — **con un matiz, ver nota abajo** | `03-marcar-una-leida-badge-baja-a-2-tras-reabrir.jpg` | ✅ con matiz |
| 4 | Más de 10 sin leer (12) | Badge = 12 | Badge = 12, formato de dos dígitos correcto | `04-doce-no-leidas-badge-12.jpg` | ✅ |
| 5 | "Marcar todas como leídas" | Badge = 0 | Badge = 0 inmediatamente | `05-marcar-todas-leidas-badge-0.jpg` | ✅ |
| 6 | Cerrar completamente la app, recibir notificaciones nuevas mientras está cerrada, reabrir | Badge sincroniza al conteo real (no se queda pegado, no se limpia a ciegas) | Badge = 2, correcto | `06-reapertura-con-pendientes-sincroniza-2.jpg` | ✅ |

**Nota sobre el escenario 3:** marcar una notificación como leída sí dispara la sincronización inmediatamente (confirmado con instrumentación real en el código durante la depuración), pero el ícono del sistema no se repinta instantáneamente mientras la app sigue en primer plano — el valor correcto queda confirmado en el siguiente ciclo de apertura/reanudación de la app (que es, en la práctica, el momento en que el usuario realmente ve el ícono, ya que mientras la app está abierta no está mirando su propio ícono). No se identificó esto como bloqueante porque no afecta el caso de uso real (ver el ícono requiere haber salido de la app), pero queda documentado como comportamiento conocido en vez de presentarlo como instantáneo sin serlo.

---

## Bugs encontrados y corregidos (solo visibles probando de verdad, no leyendo el código)

### 1. El badge no se sincronizaba en un arranque en frío real

El `useEffect` que dispara la sincronización al abrir/reanudar la app tenía un arreglo de dependencias vacío (`[]`), por lo que solo se ejecutaba una vez, en el montaje. En un arranque en frío real la sesión tarda en resolverse — el montaje casi siempre ocurre con `isAuthenticated=false`, la sincronización inicial se descartaba por el guard de autenticación, y como el efecto nunca se volvía a ejecutar, el listener de reanudación quedaba atado para siempre a esa versión bloqueada. El ícono se quedaba pegado al último valor que tenía antes de cerrar la app — nunca al conteo real.

**Cómo se encontró:** no fue visible leyendo el código — se encontró instrumentando temporalmente la app con indicadores visuales en pantalla (ya retirados) que confirmaron, en un arranque en frío real, cero invocaciones de la función de sincronización en todo el ciclo de vida.

**Corrección:** patrón estándar de "ref siempre actualizada" — el efecto ahora depende solo de `isAuthenticated` (booleano primitivo, estable entre renders) y llama siempre a la versión más reciente de la función de sincronización a través de un ref, sin necesidad de reinscribir el listener nativo en cada render.

### 2. Dos sincronizaciones en sucesión rápida podían pisarse entre sí

Marcar dos notificaciones como leídas una justo después de la otra no garantiza que las respuestas de red lleguen en el mismo orden en que se dispararon. Se confirmó en simulador: la respuesta de la primera llamada (desactualizada) llegó después que la de la segunda y sobreescribió el valor correcto con uno viejo.

**Corrección:** un contador de secuencia descarta cualquier respuesta que no corresponda a la llamada más reciente, sin importar en qué orden respondan.

---

## Hallazgo operativo durante la certificación (sin impacto en el fix en sí)

Durante las pruebas se detectó que compilar el bundle web con `npx vite build` sin especificar el modo apunta, por defecto, a `.env.production` (`VITE_API_URL=https://app.evgreen.lat`) en vez de `.env` — esto hizo que, en un punto de la depuración, la app del simulador terminara hablando momentáneamente con el servidor de producción real en vez del servidor local, en vez de reflejar el código recién escrito. Se usó la cuenta QA dedicada en todo momento (sin tocar datos de usuarios reales), y ambos entornos comparten la misma base de datos ya documentada como patrón de este proyecto, así que el impacto real fue nulo — pero vale la pena dejarlo anotado: **cualquier build de prueba debe usar `pnpm run build:ios` (o pasar `VITE_API_URL=http://localhost:3000` explícitamente), nunca `vite build` a secas**, para no probar contra el código equivocado sin darse cuenta.

---

## Resultado de la suite automatizada

242 → 246 archivos de prueba, 2375 pruebas, **0 fallos** (incluye las 12 pruebas específicas de badge en `server/push/badge-count.test.ts`, más la suite completa del repositorio corrida después de estos cambios).

---

*Documento generado el 13 de octubre de 2026, con evidencia real de dispositivo (iOS Simulator) y de base de datos, no estimaciones.*
*EVGreen Platform – Green House Project*
