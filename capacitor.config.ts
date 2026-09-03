import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.greenhproject.evgreen',
  appName: 'Evgreen',
  webDir: 'dist/public',
  server: {
    androidScheme: 'https',
    iosScheme: 'evgreen',
    // Antes usaba el hostname por defecto de Capacitor ("localhost"), lo que hacía que
    // diálogos del sistema (ej. permiso de ubicación) mostraran "localhost quiere..." en
    // vez del nombre de la app. No tiene relación con el backend/API real de la app.
    hostname: 'app.evgreen.lat',
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
  },
  ios: {
    path: 'ios',
    handleApplicationNotifications: true,
  },
};

export default config;
