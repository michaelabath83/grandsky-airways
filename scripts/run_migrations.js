#!/usr/bin/env node

// Simple migration runner: executes all SQL files in supabase/migrations in filename order
// Usage: node scripts/run_migrations.js "postgresql://user:pass@host:5432/postgres"

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function run(connectionString) {
  if (!connectionString) {
    console.error('Usage: node run_migrations.js <DATABASE_URL>');
    process.exit(1);
  }

  const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const sqls = files.map(f => ({ name: f, sql: fs.readFileSync(path.join(migrationsDir, f), 'utf8') }));

  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Connected to database. Running migrations...');
    for (const m of sqls) {
      console.log('Running', m.name);
      try {
        await client.query(m.sql);
        console.log('OK', m.name);
      } catch (err) {
        console.error('Failed', m.name, err.message || err);
        throw err;
      }
    }
    console.log('All migrations applied successfully.');
  } finally {
    await client.end();
  }
}

run(process.argv[2] || process.env.DATABASE_URL).catch(err => {
  console.error('Migration runner error:', err.message || err);
  process.exit(1);
});
