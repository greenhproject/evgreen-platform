# Evidencia externa — configuración Push nativo

**Fecha de consulta:** 2026-09-19

La documentación de [Capacitor v8](https://capacitorjs.com/docs/guides/push-notifications-firebase) establece que la aplicación Android debe registrarse en Firebase con un paquete que coincida con el `appId` y que `google-services.json` es requerido para integrar Firebase. Para iOS, la configuración del cliente debe incluir Firebase y los permisos/capacidades de notificaciones del proyecto nativo.

La guía oficial de [Firebase Cloud Messaging para Apple](https://firebase.google.com/docs/cloud-messaging/ios/get-started) establece que Firebase necesita al menos una clave de autenticación APNs cargada para entregar Push en iOS, que la app debe registrarse para notificaciones remotas y que el token de registro FCM debe sincronizarse con el servidor cada vez que pueda cambiar. La misma fuente aclara que la aceptación de un mensaje por FCM no equivale a una confirmación visible de entrega al usuario y recomienda revisar reportes de envío, aperturas e impresiones.

**Conclusión operativa:** Android e iOS requieren artefactos/configuración nativos que no deben inferirse desde el token. La aplicación debe distinguir entre token registrado, mensaje aceptado por FCM, recibido por la app y abierto por el usuario. Los archivos específicos de Firebase y la clave APNs no se guardarán en Git ni se expondrán en la interfaz; se deben proporcionar mediante el flujo seguro de compilación/release.

## Corrección aplicada — 2026-09-19

La plataforma ahora registra **cada dispositivo** en `push_devices`; ya no reemplaza silenciosamente el teléfono anterior cuando el mismo usuario inicia sesión en Android y iPhone. Cada intento deja un evento en `push_delivery_events` con estados explícitos: `REQUESTED`, `ACCEPTED` (acuse de FCM/Web Push), `RECEIVED`, `OPENED` o `FAILED`. Una respuesta de FCM ya no se comunica como “entregado”.

La app nativa reporta `RECEIVED` al recibir el evento del plugin y `OPENED` cuando el usuario toca la notificación. La prueba de preferencias muestra “aceptada por el proveedor” hasta que llegue el acuse de la app. También se preserva el Push de otros equipos al desactivar sólo el dispositivo actual.

### Bloqueador de publicación nativa detectado

El repositorio no contiene `android/app/google-services.json` ni `ios/App/App/GoogleService-Info.plist` (ambos están correctamente excluidos de Git). El proyecto Android aplica Google Services únicamente si existe el archivo. En iOS se encontró un único entitlement de desarrollo; se añadió `App.Release.entitlements` con APNs de producción y el target Release ahora lo usa.

Se añadió `scripts/verify-native-push-release.mjs`, obligatorio en `build:android:prod` y `build:ios:prod`. El build de tienda se bloqueará con una explicación si faltan o no coinciden los archivos de Firebase o si el entitlement de Release no es producción. Antes de construir y publicar:

1. Descargar desde el proyecto Firebase **evgreen-app** el `google-services.json` registrado para `com.greenhproject.evgreen` y colocarlo en `android/app/` dentro del entorno seguro de release.
2. Descargar el `GoogleService-Info.plist` del mismo bundle y colocarlo en `ios/App/App/` dentro del entorno seguro de release.
3. En Firebase Console → Project settings → Cloud Messaging, cargar una clave de autenticación APNs válida para el Team `L9YZA5HQLY` y el bundle `com.greenhproject.evgreen`.
4. Ejecutar `pnpm verify:push:native`; sólo después ejecutar los builds de producción y distribuirlos mediante el proceso de Google Play/TestFlight.

Los archivos de configuración no deben subirse a Git ni pegarse en la interfaz de EVGreen. La consola Firebase y Apple Developer son las autoridades para esa provisión; la prueba de recepción se realiza después de instalar el binario resultante en cada plataforma.
