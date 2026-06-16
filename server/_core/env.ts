export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // Auth0 configuration
  auth0Domain: process.env.AUTH0_DOMAIN ?? "",
  auth0ClientId: process.env.AUTH0_CLIENT_ID ?? "",
  auth0MobileClientId: process.env.AUTH0_MOBILE_CLIENT_ID ?? "", // Eliminado el ID hardcoded
  auth0ClientSecret: process.env.AUTH0_CLIENT_SECRET ?? "",
  mobileAppScheme: process.env.MOBILE_APP_SCHEME ?? "com.greenhproject.evgreen",
};

// Alias para compatibilidad
export const env = {
  ...ENV,
  // Firebase Cloud Messaging
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID ?? "",
  FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL ?? "",
  FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY ?? "",
  // Web Push VAPID keys
  VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY ?? "",
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY ?? "",
};
