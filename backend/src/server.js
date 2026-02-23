import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { migrate } from './db/pool.js'
import productionsRouter from './routes/productions.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))

app.use((req, res, next) => {
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:4173',
    process.env.FRONTEND_URL,
  ].filter(Boolean)

  const origin = req.headers.origin
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Access-Control-Allow-Origin', origin || '*')
  } else if (!origin || allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*')
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    database: !!process.env.DATABASE_URL,
  })
})

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/productions', productionsRouter)

app.get('/api/status', (req, res) => {
  res.json({ app: 'Studio Pro', version: '2.0.0', db: 'postgresql' })
})

// ── Debug endpoint (safe — only shows env booleans, no secrets) ───────────────
app.get('/api/debug', (req, res) => {
  res.json({
    node_env: process.env.NODE_ENV || 'not set',
    has_database_url: !!process.env.DATABASE_URL,
    port: process.env.PORT || '3001 (default)',
    uptime_seconds: Math.round(process.uptime()),
    node_version: process.version,
  })
})

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] Error on ${req.method} ${req.path}:`, err)
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Ya existe un registro con ese ID' })
  }
  if (err.code === '23503') {
    return res.status(400).json({ error: 'Referencia inválida' })
  }
  res.status(500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Error interno del servidor'
      : err.message,
  })
})

// ── Serve frontend build in production ───────────────────────────────────────
// API routes above are registered first — Express resolves them before
// reaching here. Static + SPA fallback only handles non-API paths.
if (process.env.NODE_ENV === 'production') {
  const distPath = path.resolve(__dirname, '../../frontend/dist')

  // Serve static assets (JS, CSS, images) — index:false prevents serving
  // index.html for directories, letting the SPA fallback below handle it
  app.use(express.static(distPath, { index: false }))

  // SPA fallback — serve index.html for all non-API GET requests
  // Uses next() so Express doesn't hang on any /api/* that reaches here
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path === '/health') {
      return next()
    }
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
async function start() {
  if (!process.env.DATABASE_URL) {
    console.error('❌  DATABASE_URL is not set. Add a PostgreSQL database to Railway.')
    process.exit(1)
  }
  try {
    await migrate()
  } catch (err) {
    console.error('❌  DB migration failed. Exiting.')
    process.exit(1)
  }
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅  Studio Pro v2.0 running on port ${PORT}`)
    console.log(`   ENV:    ${process.env.NODE_ENV || 'development'}`)
    console.log(`   DB:     connected`)
    console.log(`   Health: http://localhost:${PORT}/health`)
  })
}

start()

export default app
