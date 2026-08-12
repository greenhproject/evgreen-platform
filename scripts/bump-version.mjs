#!/usr/bin/env node
// Bump de versión unificado — package.json es la única fuente de verdad.
//
// Uso: node scripts/bump-version.mjs <patch|minor|major>
//
// Qué hace:
//   1. Sube MAJOR.MINOR.PATCH en package.json según el tipo indicado.
//   2. Propaga esa versión a android/app/build.gradle (versionName) y al
//      MARKETING_VERSION del proyecto de iOS.
//   3. Sube en +1 el build number de cada plataforma (versionCode en
//      Android, CURRENT_PROJECT_VERSION en iOS) — son contadores
//      independientes por store, exigidos por Google/Apple como enteros
//      siempre crecientes, sin relación directa con MAJOR.MINOR.PATCH.
//
// Este script se corre a mano cuando se va a preparar un build para subir
// a una store (Internal Testing, TestFlight, producción) — no en cada build
// de desarrollo. El número de versión web (Profile.tsx, Config.tsx, etc.)
// se toma de package.json automáticamente en cada build vía vite.config.ts,
// sin necesidad de este script.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const bumpType = process.argv[2];
if (!["patch", "minor", "major"].includes(bumpType)) {
  console.error("Uso: node scripts/bump-version.mjs <patch|minor|major>");
  process.exit(1);
}

function bumpSemver(version, type) {
  const [major, minor, patch] = version.split(".").map(Number);
  if (type === "major") return `${major + 1}.0.0`;
  if (type === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

// ── 1. package.json ──────────────────────────────────────────────────────
const pkgPath = path.join(rootDir, "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
const oldVersion = pkg.version;
const newVersion = bumpSemver(oldVersion, bumpType);
pkg.version = newVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
console.log(`package.json: ${oldVersion} → ${newVersion}`);

// ── 2. Android — build.gradle ────────────────────────────────────────────
const gradlePath = path.join(rootDir, "android", "app", "build.gradle");
let gradle = fs.readFileSync(gradlePath, "utf-8");

const oldVersionCodeMatch = gradle.match(/versionCode\s+(\d+)/);
if (!oldVersionCodeMatch) {
  console.error("No se encontró versionCode en build.gradle");
  process.exit(1);
}
const oldVersionCode = Number(oldVersionCodeMatch[1]);
const newVersionCode = oldVersionCode + 1;

gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${newVersionCode}`);
gradle = gradle.replace(/versionName\s+"[^"]+"/, `versionName "${newVersion}"`);
fs.writeFileSync(gradlePath, gradle);
console.log(`android/app/build.gradle: versionCode ${oldVersionCode} → ${newVersionCode}, versionName → "${newVersion}"`);

// ── 3. iOS — project.pbxproj ─────────────────────────────────────────────
const pbxprojPath = path.join(rootDir, "ios", "App", "App.xcodeproj", "project.pbxproj");
let pbxproj = fs.readFileSync(pbxprojPath, "utf-8");

const oldBuildNumberMatch = pbxproj.match(/CURRENT_PROJECT_VERSION = (\d+);/);
if (!oldBuildNumberMatch) {
  console.error("No se encontró CURRENT_PROJECT_VERSION en project.pbxproj");
  process.exit(1);
}
const oldBuildNumber = Number(oldBuildNumberMatch[1]);
const newBuildNumber = oldBuildNumber + 1;

pbxproj = pbxproj.replaceAll(
  /CURRENT_PROJECT_VERSION = \d+;/g,
  `CURRENT_PROJECT_VERSION = ${newBuildNumber};`
);
pbxproj = pbxproj.replaceAll(
  /MARKETING_VERSION = [\d.]+;/g,
  `MARKETING_VERSION = ${newVersion};`
);
fs.writeFileSync(pbxprojPath, pbxproj);
console.log(`ios project.pbxproj: CURRENT_PROJECT_VERSION ${oldBuildNumber} → ${newBuildNumber}, MARKETING_VERSION → ${newVersion}`);

console.log("");
console.log(`Listo. Revisa el diff, haz commit, y cuando publiques el build en la store:`);
console.log(`  git tag v${newVersion} && git push --tags`);
