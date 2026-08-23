# Auditoría defensiva de seguridad — EVGreen

**Fecha:** 21–23 de agosto de 2026  
**Alcance:** aplicación EVGreen, revisión estática de backend, autenticación y autorización tRPC, API REST pública, controles HTTP, dependencias de producción y pruebas automatizadas.  
**Método:** análisis defensivo autorizado, sin explotación activa, sin modificación de datos de usuarios, estaciones ni transacciones.

## Resumen ejecutivo

La revisión encontró una exposición horizontal confirmada en datos financieros, una práctica insegura de claves API en URLs, exceso de detalle en el endpoint público de salud y una configuración de proxy que podía debilitar el control de tasas detrás de Railway. Estos cuatro hallazgos fueron corregidos. La revisión también actualizó dependencias directas compatibles y redujo el inventario reportado por el auditor de paquetes desde **4 críticas, 57 altas, 67 moderadas y 14 bajas** hasta **0 críticas, 36 altas, 47 moderadas y 10 bajas**.

> La ausencia de hallazgos críticos en el auditor de dependencias no equivale a una garantía absoluta de seguridad. La protección efectiva requiere revisión continua, rotación de secretos, registros de auditoría y control estricto de acceso operativo.

| Severidad | Hallazgo | Estado | Corrección aplicada |
|---|---|---|---|
| Alta | Un usuario autenticado podía solicitar detalles completos de una liquidación mediante un ID arbitrario. | Corregido | `financial.getSettlementDetail` pasó a `adminProcedure`; los inversionistas conservan `mySettlementDetail`, que valida su participación. |
| Alta | La API REST aceptaba API keys en `api_key` de query string, con riesgo de filtración en URL, logs, historial o referer. | Corregido | Solo se acepta el header `X-API-Key`; la documentación pública fue alineada. |
| Media | `/api/health` devolvía memoria y estado del pool de base de datos a solicitantes no autenticados. | Corregido | El endpoint conserva estado mínimo y timestamp; se retiró telemetría interna. |
| Media | Express no declaraba explícitamente el primer proxy de Railway para el control de tasa por IP. | Corregido | Se agregó `app.set("trust proxy", 1)` para interpretar correctamente la IP cliente sin confiar en cadenas de proxies arbitrarias. |
| Crítica | Dependencias transitivas vulnerables en cadena de Firebase/AWS. | Mitigado | Se actualizaron SDKs y se regeneró el lockfile; el auditor ya no reporta avisos críticos. |

## Controles y cambios implementados

La autorización de información financiera completa se restringió a Administración. El patrón de acceso de inversionista no se eliminó: se mantiene separado y valida la participación en la liquidación. Las métricas operativas y los fondos de mantenimiento por estación también se restringieron a Administración para evitar consultas horizontales con IDs de estación.

La API REST dejó de aceptar secretos mediante parámetros de URL. Esto evita que una API key sea replicada accidentalmente por sistemas de analítica, proxies, historiales o cabeceras de referencia. Los integradores deben enviar `X-API-Key` exclusivamente mediante HTTPS.

Las dependencias directas actualizadas incluyen AWS SDK para S3, Firebase, jsPDF, Axios, WebSocket, NanoID, tRPC, Drizzle ORM y Sharp. Las versiones quedaron registradas en `pnpm-lock.yaml`, para que una instalación reproducible use las mismas resoluciones verificadas. Las actualizaciones de tRPC, Drizzle, Axios y Sharp pasaron la verificación de tipos.

## Riesgo residual y plan de reducción

El auditor de dependencias todavía informa 36 avisos altos. Los grupos principales pendientes son dependencias transitivas de `protobufjs`, `@grpc/grpc-js`, `minimatch`, `brace-expansion`, `node-forge`, `xlsx`, `linkify-it`, `nodemailer` y `path-to-regexp`. Varios dependen de bibliotecas externas que requieren actualización de su padre o un salto de versión mayor; aplicar actualizaciones forzadas sin pruebas funcionales completas podría afectar Firebase, importaciones Excel, correo o enrutamiento.

| Prioridad | Acción recomendada | Criterio de cierre |
|---|---|---|
| P1 | Mantener `pnpm audit --prod` en CI y bloquear el despliegue si reaparece una vulnerabilidad crítica. | Cero avisos críticos de producción. |
| P1 | Actualizar Firebase Admin y las bibliotecas padre cuando publiquen versiones que incorporen `protobufjs` y `@grpc/grpc-js` corregidos. | Auditoría sin vulnerabilidades altas de esos módulos. |
| P1 | Reemplazar o encapsular `xlsx` si no existe parche compatible, con pruebas de importación/exportación de archivos reales. | Sin aviso alto no mitigable en el procesador de hojas de cálculo. |
| P2 | Agregar pruebas de autorización por rol y tenant para cada procedimiento que reciba `stationId`, `settlementId` o IDs de entidades financieras. | Cobertura de casos propietario/no propietario/admin. |
| P2 | Mantener la clave Google Maps restringida a dominios autorizados y rotarla tras resolver el incidente de Railway. | Mapa de producción restaurado y clave sin restricciones globales. |

## Validación realizada

| Control | Resultado |
|---|---|
| TypeScript | Sin errores con `pnpm exec tsc --noEmit`. |
| Contrato de seguridad | 3 pruebas aprobadas: permisos financieros, eliminación de API key en query string y minimización de `/api/health`. |
| Suite completa | 2.051 de 2.053 pruebas aprobadas en ejecución paralela. Las 2 fallas de `spaces-bulk.test.ts` no se reprodujeron al ejecutar ese archivo de manera aislada (8/8 aprobadas), lo que indica interferencia de datos concurrentes; requiere estabilización de fixtures, no es una regresión atribuida a estos controles. |
| Auditoría de producción | 0 críticas, 36 altas, 47 moderadas y 10 bajas tras actualizaciones compatibles. |

## Referencias

[1]: https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/ "OWASP API Security — Broken Object Level Authorization"
[2]: https://owasp.org/API-Security/editions/2023/en/0xa2-broken-authentication/ "OWASP API Security — Broken Authentication"
[3]: https://expressjs.com/en/guide/behind-proxies.html "Express — Using Express behind proxies"
[4]: https://pnpm.io/10.x/settings "pnpm — Settings and dependency overrides"
