#!/usr/bin/env node
// scripts/perf-search.js
// Usage: SUPABASE_URL=... SUPABASE_KEY=... node scripts/perf-search.js

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Please set SUPABASE_URL and SUPABASE_KEY environment variables.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const samples = [
  'a', 'an', 'silva', 'souza', 'maria', 'joao', '123', '000', 'fer', 'sil', 'jun'
];

const runsPerSample = 40;

async function run() {
  console.log('Starting performance test...');
  const results = [];

  for (const q of samples) {
    console.log(`Sample '${q}'`);
    for (let i = 0; i < runsPerSample; i++) {
      const start = Date.now();
      const qStr = `%${q}%`;
      try {
        const { error } = await supabase
          .from('profissionais')
          .select('id', { count: 'estimated' })
          .ilike('nome_completo', qStr)
          .range(0, 24);
        const ms = Date.now() - start;
        results.push(ms);
        if (error) {
          console.error('Query error:', error.message);
        }
      } catch (err) {
        console.error('Exec error', err);
      }
    }
  }

  results.sort((a, b) => a - b);
  const p50 = results[Math.floor(results.length * 0.5)];
  const p95 = results[Math.floor(results.length * 0.95)];
  const mean = results.reduce((s, v) => s + v, 0) / results.length;

  console.log('Runs:', results.length);
  console.log('P50:', p50 + ' ms');
  console.log('P95:', p95 + ' ms');
  console.log('Mean:', Math.round(mean) + ' ms');
  console.log('All samples (ms):', results.slice(0, 20), '...');
  console.log('Please share the P50/P95 values above.');
}

run().catch((e) => { console.error(e); process.exit(1); });
