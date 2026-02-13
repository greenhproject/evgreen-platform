/**
 * Script para subir la imagen de fondo del evento a S3 del proyecto
 * Ejecutar: node scripts/upload-event-bg.mjs
 */

import fs from 'fs';
import crypto from 'crypto';

const FORGE_API_URL = process.env.BUILT_IN_FORGE_API_URL;
const FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY;

if (!FORGE_API_URL || !FORGE_API_KEY) {
  console.error('Missing BUILT_IN_FORGE_API_URL or BUILT_IN_FORGE_API_KEY');
  process.exit(1);
}

async function uploadToS3(filePath, relKey, contentType) {
  const baseUrl = FORGE_API_URL.replace(/\/+$/, '') + '/';
  const url = new URL('v1/storage/upload', baseUrl);
  url.searchParams.set('path', relKey);
  
  const fileBuffer = fs.readFileSync(filePath);
  const blob = new Blob([fileBuffer], { type: contentType });
  const form = new FormData();
  form.append('file', blob, relKey.split('/').pop());
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${FORGE_API_KEY}` },
    body: form,
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Upload failed: ${response.status} ${text}`);
  }
  
  const result = await response.json();
  console.log('Uploaded:', result.url);
  return result.url;
}

// Upload event background image
const hash = crypto.randomBytes(8).toString('hex');
const eventBgUrl = await uploadToS3('/tmp/event-bg.png', `evgreen/email-assets/event-bg-${hash}.png`, 'image/png');
console.log('\nEvent BG URL:', eventBgUrl);
console.log('\nUpdate EVENT_BG_IMAGE in server/event/event-router.ts with this URL');
