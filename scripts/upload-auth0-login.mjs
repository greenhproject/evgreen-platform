/**
 * Uploads the custom EVGreen login page to Auth0 (Classic Universal Login).
 *
 * Requirements — ONE of the following:
 *   A) The regular web-app client already has Management API access in Auth0 Dashboard
 *      Auth0 Dashboard → Applications → [app] → APIs → Authorize → Management API
 *      Permissions needed: update:clients, update:tenant_settings
 *
 *   B) Pass a separate M2M client:
 *      AUTH0_MGMT_CLIENT_ID=xxx AUTH0_MGMT_CLIENT_SECRET=yyy node scripts/upload-auth0-login.mjs
 *
 * Usage:
 *   node scripts/upload-auth0-login.mjs
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// Load .env.production
function loadEnv(file) {
  try {
    const lines = readFileSync(resolve(root, file), 'utf-8').split('\n');
    for (const line of lines) {
      const m = line.match(/^([A-Z0-9_]+)\s*=\s*"?([^"#\n]*)"?/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch { /* ignore */ }
}

loadEnv('.env');
loadEnv('.env.production');

const DOMAIN         = process.env.AUTH0_DOMAIN;
const TARGET_CLIENT  = process.env.AUTH0_CLIENT_ID;     // the app whose login page we're replacing
const MGMT_CLIENT_ID = process.env.AUTH0_MGMT_CLIENT_ID || process.env.AUTH0_CLIENT_ID;
const MGMT_SECRET    = process.env.AUTH0_MGMT_CLIENT_SECRET || process.env.AUTH0_CLIENT_SECRET;

if (!DOMAIN || !TARGET_CLIENT || !MGMT_CLIENT_ID || !MGMT_SECRET) {
  console.error('❌  Missing AUTH0_DOMAIN, AUTH0_CLIENT_ID, or AUTH0_CLIENT_SECRET in .env.production');
  process.exit(1);
}

const HTML_PATH = resolve(root, 'server', 'auth0-login.html');

// ── helpers ───────────────────────────────────────────────────────────────────

async function json(res) {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
}

async function getMgmtToken() {
  const res = await fetch(`https://${DOMAIN}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id:     MGMT_CLIENT_ID,
      client_secret: MGMT_SECRET,
      audience:      `https://${DOMAIN}/api/v2/`,
      grant_type:    'client_credentials',
    }),
  });
  const data = await json(res);
  if (!data.access_token) throw new Error(JSON.stringify(data, null, 2));
  return data.access_token;
}

async function enableClassicLogin(token) {
  const res = await fetch(`https://${DOMAIN}/api/v2/tenants/settings`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ flags: { enable_classic_universal_login: true } }),
  });
  if (res.status === 403) {
    console.warn('⚠️   Could not enable Classic Universal Login automatically (403).');
    console.warn('    → Auth0 Dashboard → Branding → Universal Login → Advanced → Classic');
    return false;
  }
  return res.ok;
}

async function uploadPage(token, html) {
  const res = await fetch(`https://${DOMAIN}/api/v2/clients/${TARGET_CLIENT}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ custom_login_page_on: true, custom_login_page: html }),
  });
  const data = await json(res);
  if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(data, null, 2)}`);
  return data;
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  const html = readFileSync(HTML_PATH, 'utf-8');
  console.log(`\n📄  Template: ${HTML_PATH} (${(html.length / 1024).toFixed(1)} KB)`);
  console.log(`📡  Auth0 tenant: ${DOMAIN}\n`);

  let token;
  try {
    process.stdout.write('1/3  Getting Management API token... ');
    token = await getMgmtToken();
    console.log('✅');
  } catch (err) {
    console.error('❌\n');
    console.error('Failed to get a Management API token.');
    console.error('To fix this, authorize the app for the Management API in Auth0:');
    console.error('  Auth0 Dashboard → Applications → APIs → Management API → Authorize');
    console.error('  Permissions: update:clients, update:tenant_settings\n');
    console.error('Or create a separate M2M app and re-run with:');
    console.error('  AUTH0_MGMT_CLIENT_ID=xxx AUTH0_MGMT_CLIENT_SECRET=yyy node scripts/upload-auth0-login.mjs\n');
    console.error('Manual fallback:');
    console.error('  Auth0 Dashboard → Branding → Universal Login → Customize Login Page');
    console.error('  Enable Classic experience, then paste server/auth0-login.html\n');
    process.exit(1);
  }

  process.stdout.write('2/3  Enabling Classic Universal Login... ');
  const ok = await enableClassicLogin(token);
  console.log(ok ? '✅' : '⚠️  (may need manual toggle — see above)');

  try {
    process.stdout.write('3/3  Uploading custom login page... ');
    await uploadPage(token, html);
    console.log('✅\n');
    console.log('🎉  Done! The login page is now live.');
    console.log(`    Preview: https://${DOMAIN}/authorize?response_type=code&client_id=${TARGET_CLIENT}&redirect_uri=https://example.com&scope=openid\n`);
  } catch (err) {
    console.error('❌\n');
    console.error(String(err));
    console.error('\nManual fallback:');
    console.error('  Auth0 Dashboard → Branding → Universal Login → Customize Login Page');
    console.error('  Enable Classic experience, then paste server/auth0-login.html\n');
    process.exit(1);
  }
}

main();
