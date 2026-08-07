# Informe de Desarrollo – Mes 3
## Fase: Publicación en Tiendas Oficiales
### Hito: Primera publicación o radicación inicial del aplicativo en tiendas oficiales

**Proyecto:** EVGreen Platform – Aplicación Web y Móvil
**Desarrollador:** Leonardo López
**Período:** Mes 3 del contrato

---

## Resumen Ejecutivo

Durante el tercer mes del contrato se completó la **publicación de la aplicación EVGreen en la App Store de Apple (iOS)**, quedando **disponible públicamente para descarga**, y se **radicó la aplicación en Google Play Store (Android)**, actualmente en su **etapa final de revisión**.

En el proceso de validación previo a la publicación se detectó una **falla crítica de inicio de sesión** que afectaba específicamente a los teléfonos Android con la versión más reciente del sistema operativo (**Android 16**). Esta falla fue **diagnosticada, corregida y validada exitosamente antes de que impactara a usuarios reales**, y la versión corregida ya está lista para salir a producción tan pronto se apruebe la radicación en curso.

> **En resumen:** iOS ya está publicado y disponible al público. Android está radicado y a punto de salir, con una falla crítica ya resuelta de forma preventiva.

---

## 1. Publicación en Apple App Store (iOS)

- Se completó exitosamente el **proceso de envío y revisión de la aplicación ante Apple**.
- La aplicación **EVGreen** quedó **publicada y disponible al público** en la App Store, lista para ser descargada por cualquier usuario de iPhone.
- **Enlace público de la aplicación:** https://apps.apple.com/co/app/evgreen/id6783473071
- Se validó el funcionamiento de la aplicación **instalada directamente desde la App Store** en un dispositivo real.

## 2. Radicación en Google Play Store (Android)

- Se completó el **envío de la aplicación a Google Play Store** para su revisión oficial, la cual se encuentra en su **etapa final**.
- **Enlace de acceso interno** para verificación de la versión más reciente: https://play.google.com/apps/internaltest/4700940778153046016

### ⚠ Falla crítica detectada y corregida antes de salir a producción

- Durante las pruebas de validación se identificó que los usuarios con celulares Android de última generación (**versión 16 del sistema operativo**) **no podían iniciar sesión** en la aplicación, mientras que en equipos con versiones anteriores de Android sí funcionaba correctamente.
- Se investigó la causa raíz: **una configuración interna del sistema estaba interceptando el proceso de inicio de sesión** únicamente en los equipos más nuevos.
- Se corrigió la configuración y se **validó exhaustivamente** el inicio de sesión, cierre de sesión y cancelación del proceso, tanto en un equipo con Android 16 como en un equipo con una versión anterior, **confirmando que el problema quedó resuelto** sin afectar el funcionamiento ya validado.
- La versión corregida **quedó lista y disponible para revisión interna**, a la espera de que se apruebe la radicación actual para salir a producción de forma inmediata.

## 3. Validación en Dispositivos Reales

- Se realizaron **pruebas de inicio y cierre de sesión en dispositivos Android e iOS reales**, confirmando el correcto funcionamiento de la aplicación de cara a los usuarios finales.

---

## Resumen de Entregables

| Área | Estado |
|------|--------|
| **Publicación de la app en Apple App Store** | ✅ Completo — disponible al público |
| **Radicación de la app en Google Play Store** | ✅ Completo — en revisión final |
| **Detección y corrección de falla de inicio de sesión en Android 16** | ✅ Completo — validado |
| **Validación en dispositivos reales (Android e iOS)** | ✅ Validado |

---

## Pasos a Seguir

1. **Aprobación de Google Play Store**
   Se espera la respuesta de la revisión de Google sobre la radicación actual. Tiempo estimado: **1–3 días hábiles**.

2. **Salida a producción de la versión corregida (Android)**
   Una vez aprobada la radicación actual, se publicará **de inmediato** la versión con la corrección de inicio de sesión para Android 16, quedando disponible para todos los usuarios.

3. **Monitoreo post-publicación**
   Seguimiento del comportamiento de la aplicación en ambas tiendas durante los primeros días tras la salida a producción, para atender cualquier observación adicional que surja.

---

*Documento generado el 15 de julio de 2026.*
*EVGreen Platform – Green House Project*
