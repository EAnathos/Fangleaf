// Applique les migrations SQL de supabase/migrations/ qui ne l'ont pas encore été.
// Usage : npm run db:migrate   (nécessite DATABASE_URL dans .env : chaîne de connexion Postgres de Supabase)
//
// Chaque fichier est appliqué une seule fois, dans une transaction, et noté dans la table _migrations.

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

try {
  process.loadEnvFile();
} catch { /* pas de .env */ }

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL manquant dans .env (Supabase › Project Settings › Database › Connection string › URI).');
  process.exit(1);
}

const dir = fileURLToPath(new URL('../supabase/migrations/', import.meta.url));
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query('create table if not exists public._migrations (name text primary key, applied_at timestamptz not null default now())');
  await client.query('alter table public._migrations enable row level security'); // invisible depuis l'API publique
  const done = new Set((await client.query('select name from public._migrations')).rows.map((r) => r.name as string));
  let applied = 0;
  for (const f of files) {
    if (done.has(f)) continue;
    await client.query('begin');
    try {
      await client.query(readFileSync(dir + f, 'utf8'));
      await client.query('insert into public._migrations (name) values ($1)', [f]);
      await client.query('commit');
      console.log(`✔ ${f}`);
      applied++;
    } catch (e) {
      await client.query('rollback');
      console.error(`✘ ${f} : ${(e as Error).message}`);
      process.exitCode = 1;
      break;
    }
  }
  // Demande à l'API Supabase de recharger le schéma (sinon les nouvelles tables peuvent mettre un moment à apparaître).
  if (applied) await client.query("notify pgrst, 'reload schema'");
  console.log(applied ? `${applied} migration(s) appliquée(s).` : 'Base déjà à jour.');
} finally {
  await client.end();
}
