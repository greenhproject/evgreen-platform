import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.greenhproject.evgreen',
  appName: 'Evgreen',
  webDir: 'dist/public', // Sincronizado con vite.config.ts
  server: {
    androidScheme: 'https',
    iosScheme: 'evgreen' // Esquema para que Auth0 pueda volver a la app en iOS
  },
  plugins: {
    CapacitorHttp: {
      enabled: true
    }
  },
  ios: {
    path: 'ios',
    handleApplicationNotifications: true
  }
};

export default config;
