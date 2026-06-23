#!/usr/bin/env node

// Upload local css/assets files to Supabase Storage and update DB rows where possible.
// Usage: node scripts/upload_assets_and_update_db.js

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load env from .env.production.local if present
const envPath = path.join(__dirname, '..', '.env.production.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split(/\r?\n/).forEach(line => {
    const m = line.match(/^\s*([A-Z0-9_]+)=(.*)$/);
    if (m) {
      const k = m[1];
      let v = m[2];
      v = v.replace(/^"|"$/g, '');
      process.env[k] = process.env[k] || v;
    }
  });
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment or .env.production.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const localAssetsDir = path.join(__dirname, '..', 'css', 'assets');
const bucket = 'public-assets';

async function ensureBucket() {
  try {
    // try to create (will fail if exists) but ignore error
    await supabase.storage.createBucket(bucket, { public: true });
    console.log('Created bucket', bucket);
  } catch (e) {
    // ignore - might already exist
  }
}

async function uploadFile(relPath, absPath) {
  const destPath = relPath.replace(/\\\\/g, '/');
  const file = fs.readFileSync(absPath);
  try {
    const { data, error } = await supabase.storage.from(bucket).upload(destPath, file, { upsert: true });
    if (error) throw error;
    const publicUrl = supabase.storage.from(bucket).getPublicUrl(destPath).data.publicUrl;
    return publicUrl;
  } catch (err) {
    console.error('Upload failed for', relPath, err.message || err);
    return null;
  }
}

async function walkAndUpload() {
  const mapping = {};
  async function walk(dir, prefix = '') {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const abs = path.join(dir, e.name);
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.isDirectory()) {
        await walk(abs, rel);
      } else if (e.isFile()) {
        console.log('Uploading', rel);
        const url = await uploadFile(rel, abs);
        if (url) mapping[rel] = url;
      }
    }
  }
  await walk(localAssetsDir);
  return mapping;
}

async function updateDbWithMapping(mapping) {
  // Update airlines logos if possible
  const logos = Object.keys(mapping).filter(k => k.startsWith('logos/') || k.startsWith('logos\\'));
  for (const l of logos) {
    const file = path.basename(l);
    const code = file.split('.')[0].toUpperCase();
    const url = mapping[l];
    try {
      const { error } = await supabase.from('airlines').update({ logo_url: url }).eq('code', code);
      if (error) {
        console.log(`Could not update airline ${code}: ${error.message}`);
      } else {
        console.log(`Updated airline ${code} -> logo_url`);
      }
    } catch (e) {
      console.log(`Airlines update failed for ${code}: ${e.message}`);
    }
  }

  // Map destination images to airports by code
  const mappingByAirport = {
    'CDG': 'france.jpg',
    'DXB': 'uae.jpg',
    'HND': 'japan.jpg',
    'BCN': 'spain.jpg',
    'CPT': 'south-africa.jpg',
    'SYD': 'australia.jpg'
  };
  for (const [code, img] of Object.entries(mappingByAirport)) {
    const key = img;
    // try both root and nested path
    const candidates = [key, key.replace('/', '\\')].map(x => x);
    let url = null;
    if (mapping[`../css/assets/${key}`]) url = mapping[`../css/assets/${key}`];
    if (mapping[key]) url = mapping[key];
    if (!url) {
      // try without path
      const rels = Object.keys(mapping).filter(k => k.endsWith(key));
      if (rels.length) url = mapping[rels[0]];
    }
    if (!url) {
      console.log(`No uploaded image found for ${img} (airport ${code})`);
      continue;
    }
    try {
      const { error } = await supabase.from('airports').update({ image_url: url }).eq('code', code);
      if (error) console.log(`Could not update airport ${code}: ${error.message}`);
      else console.log(`Updated airport ${code} -> image_url`);
    } catch (e) {
      console.log(`Airports update failed for ${code}: ${e.message}`);
    }
  }
}

(async () => {
  try {
    console.log('Ensuring bucket exists...');
    await ensureBucket();
    console.log('Uploading assets from', localAssetsDir);
    const mapping = await walkAndUpload();
    const outPath = path.join(__dirname, '..', 'supabase_asset_urls.json');
    fs.writeFileSync(outPath, JSON.stringify(mapping, null, 2), 'utf8');
    console.log('Wrote mapping to', outPath);
    console.log('Attempting to update DB rows (airlines, airports) with public URLs...');
    await updateDbWithMapping(mapping);
    console.log('Done. Review supabase_asset_urls.json for public URLs.');
  } catch (e) {
    console.error('Script failed:', e.message || e);
    process.exit(1);
  }
})();
