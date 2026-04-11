# Configuración y Roadmap para Capacitor (iOS & Android)

Este documento detalla la configuración inicial realizada para transformar la aplicación web en una aplicación nativa móvil usando **Capacitor**, y establece los pasos a seguir para su publicación en el **Apple App Store** y **Google Play Store**.

## 1. Configuración Realizada

Se integró Capacitor en el proyecto sin afectar los estilos ni la lógica existente. Las tareas completadas fueron:

1. **Instalación de Dependencias**:
   - `@capacitor/core` (Dependencia principal).
   - `@capacitor/cli`, `@capacitor/android`, `@capacitor/ios` (Dependencias de desarrollo).

2. **Inicialización de Capacitor**:
   - Se creó el archivo `capacitor.config.ts`.
   - **App ID**: `com.evgreen.app` (Identificador único de la app).
   - **App Name**: `Green EV Platform` (Nombre de la aplicación).
   - **Web Directory**: `dist/public` (Apuntando a la carpeta donde Vite exporta los archivos construidos).

3. **Agregado de Plataformas Nativas**:
   - Se inicializaron las carpetas `android` e `ios` dentro del proyecto utilizando `npx cap add android` y `npx cap add ios`. Estas carpetas contienen los proyectos nativos que pueden ser abiertos en Android Studio y Xcode.

---

## 2. Roadmap: Siguientes Pasos para Publicación

Ahora que la infraestructura está lista, debes seguir este flujo de trabajo para compilar y subir tu aplicación.

### Fase 1: Sincronización y Preparación Local

1. **Compilar el Proyecto Web**:
   Cada vez que hagas un cambio en tu código de React/Vite, debes compilar el proyecto:
   ```bash
   npm run build
   ```
2. **Sincronizar con Capacitor**:
   Copia los archivos compilados hacia las carpetas nativas de Android e iOS:
   ```bash
   npx cap sync
   ```
3. **Generar Iconos y Pantallas de Carga (Splash Screens)**:
   Se recomienda usar la herramienta oficial `@capacitor/assets` para generar todos los tamaños automáticamente desde una única imagen.
   ```bash
   npm install -D @capacitor/assets
   npx capacitor-assets generate
   ```

### Fase 2: Publicación en Android (Google Play Store)

1. **Abrir Android Studio**:
   ```bash
   npx cap open android
   ```
2. **Configuraciones de la App**:
   - Asegúrate de tener configurado el `versionCode` y `versionName` correctos en el archivo `build.gradle` (nivel de la app).
   - Configura permisos necesarios en `AndroidManifest.xml` (si tu app usa cámara, ubicación, etc.).
3. **Generar el App Bundle (AAB)**:
   - En Android Studio ve a: `Build` > `Generate Signed Bundle / APK...`
   - Selecciona **Android App Bundle**.
   - Crea un nuevo "Keystore" (llave criptográfica) si no tienes uno y guárdalo en un lugar seguro (se requerirá siempre para actualizar la app).
4. **Subir a Google Play Console**:
   - Crea tu cuenta de desarrollador en Google Play Console.
   - Crea la aplicación, completa los cuestionarios (contenido, privacidad, etc.).
   - Sube el archivo `.aab` generado a la pista de pruebas (Internal/Closed Testing) o a Producción.

### Fase 3: Publicación en iOS (Apple App Store)

1. **Requisitos Previos**:
   - Necesitas una Mac con **Xcode** instalado.
   - Cuenta de desarrollador activa en el **Apple Developer Program**.
2. **Abrir Xcode**:
   ```bash
   npx cap open ios
   ```
3. **Configuraciones de la App**:
   - Selecciona tu equipo (Team) en la pestaña "Signing & Capabilities" para activar el aprovisionamiento automático (Automatic Provisioning).
   - Modifica el *Display Name* y verifica el *Bundle Identifier* (`com.evgreen.app`).
   - Si tu app requiere permisos de hardware o acceso a datos (ej. Cámara, Ubicación), debes agregar las descripciones de uso (`NSCameraUsageDescription`, etc.) en el archivo `Info.plist`.
4. **Archivar la App**:
   - Selecciona "Any iOS Device (arm64)" como tu destino en la barra superior.
   - Ve al menú superior: `Product` > `Archive`.
5. **Subir a App Store Connect**:
   - Una vez finalizado el proceso de "Archive", se abrirá el "Organizer".
   - Haz clic en **Distribute App** y sigue los pasos para subir tu aplicación a **TestFlight** y posteriormente enviarla a revisión para la App Store.

### Fase 4: Pruebas Finales y Mantenimiento

- **TestFlight (iOS)** y **Internal Testing (Android)**: Invita a miembros de tu equipo para probar la app en dispositivos físicos reales.
- **Actualizaciones Web**: Si solo haces cambios en la lógica web (HTML, CSS, JS) y no usas nuevos plugins nativos, puedes usar herramientas como [Capacitor Updater](https://capacitorjs.com/docs/guides/live-reload) (o herramientas similares tipo "Live Updates") en el futuro para actualizar a los usuarios sin pasar por revisión de tiendas. Si no, simplemente repite el ciclo: `build` -> `sync` -> `compilar en Xcode/Android Studio` -> `subir`.
