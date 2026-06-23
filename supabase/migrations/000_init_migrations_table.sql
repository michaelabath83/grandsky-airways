-- Initialize Supabase migration infrastructure if missing
-- Run this in Supabase SQL editor if migrations fail with:
-- "relation "supabase_migrations.schema_migrations" does not exist"

CREATE SCHEMA IF NOT EXISTS supabase_migrations;

CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
  version bigint PRIMARY KEY,
  name text NOT NULL,
  statement text NOT NULL,
  installed_on timestamptz NOT NULL DEFAULT now()
);
