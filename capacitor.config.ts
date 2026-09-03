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
  },
  ios: {
    path: 'ios',
    handleApplicationNotifications: true,
  },
};

export default config;
