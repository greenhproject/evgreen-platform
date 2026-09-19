#!/usr/bin/env node
/**
 * Bloquea la creación de un artefacto móvil de producción sin los insumos
 * nativos de Firebase/APNs. No imprime secretos, tokens ni API keys.
 *
 * Uso: node scripts/verify-native-push-release.mjs [android|ios|both]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = process.argv[2] || "both";
const expectedBundleId = "com.greenhproject.evgreen";
const errors = [];

function readRequired(relativePath, label) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) {
    errors.push(`${label}: falta ${relativePath}. Descárgalo desde el proyecto Firebase autorizado y colócalo sólo en el entorno seguro de release.`);
    return null;
  }
  return fs.readFileSync(filePath, "utf8");
}

function verifyAndroid() {
  const contents = readRequired("android/app/google-services.json", "Android FCM");
  const gradle = readRequired("android/app/build.gradle", "Android build");
  if (contents) {
    try {
      const config = JSON.parse(contents);
      const packageNames = (config.client || []).map((client) => client?.client_info?.android_client_info?.package_name).filter(Boolean);
      if (!packageNames.includes(expectedBundleId)) {
        errors.push(`Android FCM: google-services.json no contiene el paquete ${expectedBundleId}.`);
      }
    } catch {
      errors.push("Android FCM: google-services.json no es JSON válido.");
    }
  }
  if (gradle && !gradle.includes("apply plugin: 'com.google.gms.google-services'")) {
    errors.push("Android FCM: build.gradle no aplica el plugin de Google Services.");
  }
}

function plistValue(plist, key) {
  const expression = new RegExp(`<key>${key}</key>\\s*<string>([^<]+)</string>`);
  return plist.match(expression)?.[1];
}

function verifyIos() {
  const plist = readRequired("ios/App/App/GoogleService-Info.plist", "iOS FCM");
  const releaseEntitlements = readRequired("ios/App/App/App.Release.entitlements", "Entitlements iOS Release");
  const project = readRequired("ios/App/App.xcodeproj/project.pbxproj", "Proyecto iOS");
  if (plist && plistValue(plist, "BUNDLE_ID") !== expectedBundleId) {
    errors.push(`iOS FCM: GoogleService-Info.plist no coincide con ${expectedBundleId}.`);
  }
  if (releaseEntitlements && !releaseEntitlements.includes("<string>production</string>")) {
    errors.push("iOS APNs: el entitlement de Release debe usar aps-environment=production.");
  }
  if (project && !project.includes("CODE_SIGN_ENTITLEMENTS = App/App.Release.entitlements")) {
    errors.push("iOS APNs: el target Release no usa App.Release.entitlements.");
  }
}

if (!new Set(["android", "ios", "both"]).has(target)) {
  console.error("Uso: node scripts/verify-native-push-release.mjs [android|ios|both]");
  process.exit(2);
}
if (target === "android" || target === "both") verifyAndroid();
if (target === "ios" || target === "both") verifyIos();

if (errors.length) {
  console.error("\n[Push Release Preflight] BLOQUEADO:\n");
  for (const error of errors) console.error(`- ${error}`);
  console.error("\nNo se debe publicar este build hasta resolver todos los puntos anteriores.");
  process.exit(1);
}

console.log(`[Push Release Preflight] OK (${target}). Firebase y APNs están presentes para ${expectedBundleId}.`);
