#!/usr/bin/env node
// scripts/perf-search.js
// Usage examples:
// 1) Use synthetic samples (default):
//    SUPABASE_URL=... SUPABASE_KEY=... node scripts/perf-search.js
// 2) Sample real values from DB (recommended):
//    SUPABASE_URL=... SUPABASE_KEY=... SAMPLE_FROM_DB=1 node scripts/perf-search.js
// 3) Target homolog/staging: point SUPABASE_URL and SUPABASE_KEY to that environment

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const SAMPLE_FROM_DB = process.env.SAMPLE_FROM_DB === "1" || process.env.SAMPLE_FROM_DB === "true";
const SAMPLES_TO_FETCH = parseInt(process.env.SAMPLES_TO_FETCH || "200", 10);
const runsPerSample = parseInt(process.env.RUNS_PER_SAMPLE || "40", 10);

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Please set SUPABASE_URL and SUPABASE_KEY environment variables.");
  process.exit(1);
}

// IMPORTANT: Use the anon/public key (not service_role). Running with anon key preserves RLS.

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

function pickRandom(arr, n) {
  const res = [];
  const copy = arr.slice();
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    res.push(copy.splice(idx, 1)[0]);
  }
  return res;
}

async function buildSamplesFromDb() {
  console.log("Sampling real values from profissionais table...");
  // fetch a block of rows (not too many) and sample client-side to avoid heavy queries
  const { data, error } = await supabase
    .from("profissionais")
    .select("nome_completo, cpf, matricula")
    .limit(1000);
  if (error) {
    console.error("Error fetching sample from DB:", error.message || error);
    process.exit(1);
  }
  const rows = data || [];
  if (rows.length === 0) {
    console.error("No profissionais rows found to sample from.");
    process.exit(1);
  }

  const sampled = pickRandom(rows, Math.min(SAMPLES_TO_FETCH, rows.length));
  const tokens = [];

  for (const r of sampled) {
    if (r.nome_completo) {
      const name = r.nome_completo.trim();
      // push first name, last name, and a 3-char prefix
      const parts = name.split(/\s+/).filter(Boolean);
      if (parts.length) tokens.push(parts[0].slice(0, 5));
      if (parts.length > 1) tokens.push(parts[parts.length - 1].slice(0, 5));
      if (name.length >= 3) tokens.push(name.slice(0, 3));
    }
    if (r.cpf) {
      const digits = (r.cpf + "").replace(/\D/g, "");
      if (digits.length >= 3) tokens.push(digits.slice(0, 3));
    }
    if (r.matricula) {
      const m = (r.matricula + "").trim();
      if (m.length >= 3) tokens.push(m.slice(0, 3));
    }
  }

  // dedupe tokens and keep reasonable amount
  const uniq = Array.from(new Set(tokens)).slice(0, 120);
  console.log(`Built ${uniq.length} sample tokens from DB.`);
  return uniq;
}

async function run() {
  let samples = ["a", "an", "silva", "souza", "maria", "joao", "123", "000", "fer", "sil", "jun"];

  if (SAMPLE_FROM_DB) {
    samples = await buildSamplesFromDb();
  }

  console.log("Samples used:", samples.slice(0, 20), "... total", samples.length);

  const results = [];

  for (const q of samples) {
    // warm up a few times per token (to reduce cold-start effects) - optional
    for (let w = 0; w < Math.min(3, runsPerSample); w++) {
      await supabase
        .from("profissionais")
        .select("id", { count: "estimated" })
        .ilike("nome_completo", `%${q}%`)
        .range(0, 24);
    }
    for (let i = 0; i < runsPerSample; i++) {
      const start = Date.now();
      try {
        const { error } = await supabase
          .from("profissionais")
          .select("id", { count: "estimated" })
          .ilike("nome_completo", `%${q}%`)
          .range(0, 24);
        const ms = Date.now() - start;
        results.push(ms);
        if (error) {
          console.error("Query error:", error.message);
        }
      } catch (err) {
        console.error("Exec error", err);
      }
    }
  }

  results.sort((a, b) => a - b);
  const p50 = results[Math.floor(results.length * 0.5)];
  const p95 = results[Math.floor(results.length * 0.95)];
  const mean = results.reduce((s, v) => s + v, 0) / results.length;

  console.log("Runs:", results.length);
  console.log("P50:", p50 + " ms");
  console.log("P95:", p95 + " ms");
  console.log("Mean:", Math.round(mean) + " ms");
  console.log("Sample of results (first 40ms):", results.slice(0, 40));
  console.log(
    "\nImportant: these timings reflect client->PostgREST roundtrip and server execution under the environment you targeted (homolog/prod).",
  );
  console.log(
    "If P95 >= 2000 ms, request an EXPLAIN JSON for representative queries to investigate the execution plan.",
  );
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
