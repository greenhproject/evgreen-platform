import fs from 'fs';
import crypto from 'crypto';

const FORGE_API_URL = process.env.BUILT_IN_FORGE_API_URL;
const FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY;

if (!FORGE_API_URL || !FORGE_API_KEY) {
  console.error('Missing env vars');
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
  return result.url;
}

const hash = crypto.randomBytes(6).toString('hex');
const logoUrl = await uploadToS3('/tmp/evgreen-logo.png', `evgreen/email-assets/logo-${hash}.png`, 'image/png');
console.log('Logo URL:', logoUrl);
