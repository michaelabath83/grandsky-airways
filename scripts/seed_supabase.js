#!/usr/bin/env node

/**
 * Supabase Demo Data Seeder
 * 
 * This script seeds the Supabase database with demo airlines, airports, and flights.
 * Usage: node scripts/seed_supabase.js
 * 
 * Prerequisites:
 * 1. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment
 * 2. Run Supabase migrations first (002_add_profiles_tickets.sql)
 * 3. npm install @supabase/supabase-js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable not set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function seedData() {
  console.log('🌱 Starting Supabase seed...\n');

  try {
    // Load seed files
    const airlinesPath = path.join(__dirname, '../firestore-seed/airlines.json');
    const airportsPath = path.join(__dirname, '../firestore-seed/airports.json');
    const flightsPath = path.join(__dirname, '../firestore-seed/flights.json');

    const airlines = JSON.parse(fs.readFileSync(airlinesPath, 'utf8'));
    const airports = JSON.parse(fs.readFileSync(airportsPath, 'utf8'));
    const flights = JSON.parse(fs.readFileSync(flightsPath, 'utf8'));

    // Seed airlines
    console.log(`📋 Seeding ${airlines.length} airlines...`);
    const { error: airlinesError } = await supabase
      .from('airlines')
      .upsert(airlines, { onConflict: 'code' });
    if (airlinesError) throw new Error(`Airlines seed failed: ${airlinesError.message}`);
    console.log('✅ Airlines seeded\n');

    // Seed airports
    console.log(`✈️  Seeding ${airports.length} airports...`);
    const { error: airportsError } = await supabase
      .from('airports')
      .upsert(airports, { onConflict: 'code' });
    if (airportsError) throw new Error(`Airports seed failed: ${airportsError.message}`);
    console.log('✅ Airports seeded\n');

    // Seed flights
    console.log(`🛫 Seeding ${flights.length} flights...`);
    
    // Map Firestore field names to Postgres snake_case
    const flightsMapped = flights.map(f => ({
      airline: f.airline || f.airline_code || '',
      from_code: f.fromCode || f.from_code || f.from || '',
      to_code: f.toCode || f.to_code || f.to || '',
      from_city: f.fromCity || f.from_city || '',
      to_city: f.toCity || f.to_city || '',
      price: f.price || 0,
      featured: f.featured || false
    }));

    const { error: flightsError } = await supabase
      .from('flights')
      .upsert(flightsMapped, { onConflict: 'id' });
    if (flightsError) throw new Error(`Flights seed failed: ${flightsError.message}`);
    console.log('✅ Flights seeded\n');

    // Verify seeding
    const { count: airlinesCount } = await supabase
      .from('airlines')
      .select('*', { count: 'exact', head: true });
    const { count: airportsCount } = await supabase
      .from('airports')
      .select('*', { count: 'exact', head: true });
    const { count: flightsCount } = await supabase
      .from('flights')
      .select('*', { count: 'exact', head: true });

    console.log('📊 Seeding summary:');
    console.log(`   Airlines: ${airlinesCount} rows`);
    console.log(`   Airports: ${airportsCount} rows`);
    console.log(`   Flights: ${flightsCount} rows`);
    console.log('\n✅ Supabase seeding complete!');
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  }
}

seedData();
