import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.greenhproject.evgreen',
  appName: 'Evgreen',
  webDir: 'dist/public',
  server: {
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
