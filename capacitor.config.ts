import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.greenhproject.evgreen',
  appName: 'Evgreen',
  webDir: 'dist/public',
  server: {
    // OJO: nunca usar aquí el mismo dominio del backend real (app.evgreen.lat).
    // Capacitor trata este hostname como el origen local del WebView — si
    // coincide con el dominio de la API, intercepta las llamadas reales
    // (/api/trpc/...) como si fueran archivos locales y las rompe todas
    // ("Unable to open asset URL"). Se usa un subdominio aparte, que no
    // necesita existir de verdad, solo para que los diálogos del sistema
    // (geolocalización, etc.) no digan "localhost".
    hostname: 'mobile.evgreen.lat',
    androidScheme: 'https',
    iosScheme: 'evgreen',
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#052E16',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    // Sin esta configuración iOS puede recibir el Push en foreground pero no
    // presentarlo visualmente. El plugin reporta RECEIVED y el sistema muestra
    // alerta, sonido y badge de forma coherente con Android.
    FirebaseMessaging: {
      presentationOptions: ['alert', 'badge', 'sound'],
    },
  },
  ios: {
    path: 'ios',
    handleApplicationNotifications: true,
  },
};

export default config;
