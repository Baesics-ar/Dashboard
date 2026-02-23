import pg from 'pg'

const { Pool } = pg

// Railway injects DATABASE_URL automatically when you add a Postgres plugin
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

pool.on('error', (err) => {
  console.error('Unexpected DB pool error:', err)
})

// ── Migration — creates all tables if they don't exist ────────────────────────
// Runs on every server start; safe to re-run (uses IF NOT EXISTS)
export async function migrate() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // productions — one row per production order
    await client.query(`
      CREATE TABLE IF NOT EXISTS productions (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        fabric      TEXT NOT NULL DEFAULT 'Jersey 30/1',
        weight_per_unit INTEGER NOT NULL DEFAULT 0,
        stage       TEXT NOT NULL DEFAULT 'comprar_tela',
        deadline    DATE,
        created_at  DATE NOT NULL DEFAULT CURRENT_DATE,
        cost_tela   INTEGER NOT NULL DEFAULT 0,
        cost_estampa INTEGER NOT NULL DEFAULT 0,
        cost_corte  INTEGER NOT NULL DEFAULT 0,
        cost_avios  INTEGER NOT NULL DEFAULT 0,
        tasks       JSONB NOT NULL DEFAULT '{}',
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    // models — belongs to a production
    await client.query(`
      CREATE TABLE IF NOT EXISTS models (
        id            TEXT PRIMARY KEY,
        production_id TEXT NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
        name          TEXT NOT NULL DEFAULT '',
        sort_order    INTEGER NOT NULL DEFAULT 0
      )
    `)

    // variants — belongs to a model
    await client.query(`
      CREATE TABLE IF NOT EXISTS variants (
        id       TEXT PRIMARY KEY,
        model_id TEXT NOT NULL REFERENCES models(id) ON DELETE CASCADE,
        color    TEXT NOT NULL DEFAULT '',
        stamp    TEXT NOT NULL DEFAULT '',
        size     TEXT NOT NULL DEFAULT '',
        qty      INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0
      )
    `)

    // Indexes for common queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_models_production_id ON models(production_id);
      CREATE INDEX IF NOT EXISTS idx_variants_model_id ON variants(model_id);
      CREATE INDEX IF NOT EXISTS idx_productions_stage ON productions(stage);
      CREATE INDEX IF NOT EXISTS idx_productions_created_at ON productions(created_at);
    `)

    await client.query('COMMIT')
    console.log('✅  Database migration complete')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('❌  Migration failed:', err)
    throw err
  } finally {
    client.release()
  }
}

export default pool
