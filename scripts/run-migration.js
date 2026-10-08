#!/usr/bin/env node
// Run one reviewed, idempotent SQL migration using node-postgres.

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const url = process.env.DATABASE_URL || process.env.STAGING_DATABASE_URL;
  if (!url) {
    console.error('ERROR: DATABASE_URL (or STAGING_DATABASE_URL) is not set.');
    process.exit(2);
  }

  const requested = process.env.MIGRATION_FILE || 'supabase/patch-v17-sandbox-workflow.sql';
  const file = path?.resolve(__dirname, '..', requested);
  if (!fs?.existsSync(file)) {
    console.error('Migration file not found:', file);
    process.exit(3);
  }

  const sql = fs?.readFileSync(file, 'utf8');
  const client = new Client({ connectionString: url });

  try {
    await client?.connect();
    console.log('Connected to', url?.replace(/:\/\/.*@/, '://***@'));
    console.log('Beginning migration...');
    await client?.query('BEGIN');
    await client?.query(sql);
    await client?.query('COMMIT');
    console.log('Migration applied successfully.');
  } catch (err) {
    console.error('Migration failed:', err?.message || err);
    try {
      await client?.query('ROLLBACK');
      console.log('Rolled back transaction');
    } catch (e) {
      console.error('Rollback failed:', e?.message || e);
    }
    process.exit(4);
  } finally {
    await client?.end();
  }
}

main();
