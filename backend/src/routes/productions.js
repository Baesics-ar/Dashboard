import { Router } from 'express'
import {
  getAllProductions,
  getProduction,
  createProduction,
  updateProduction,
  updateStage,
  updateTasks,
  deleteProduction,
} from '../db/queries.js'
import { validateProduction, asyncHandler } from '../middleware/validate.js'

const router = Router()

// ── GET /api/productions ──────────────────────────────────────────────────────
// Returns all productions with models + variants nested
router.get('/', asyncHandler(async (req, res) => {
  const prods = await getAllProductions()
  res.json(prods)
}))

// ── GET /api/productions/:id ──────────────────────────────────────────────────
router.get('/:id', asyncHandler(async (req, res) => {
  const prod = await getProduction(req.params.id)
  if (!prod) return res.status(404).json({ error: 'Producción no encontrada' })
  res.json(prod)
}))

// ── POST /api/productions ─────────────────────────────────────────────────────
router.post('/', validateProduction, asyncHandler(async (req, res) => {
  const prod = await createProduction(req.body)
  res.status(201).json(prod)
}))

// ── PUT /api/productions/:id ──────────────────────────────────────────────────
// Full update (edit form)
router.put('/:id', validateProduction, asyncHandler(async (req, res) => {
  const prod = await updateProduction(req.params.id, req.body)
  res.json(prod)
}))

// ── PATCH /api/productions/:id/stage ─────────────────────────────────────────
// Fast stage update from the detail view dropdown
router.patch('/:id/stage', asyncHandler(async (req, res) => {
  const { stage } = req.body
  if (!stage) return res.status(400).json({ error: 'Stage requerido' })
  const result = await updateStage(req.params.id, stage)
  res.json(result)
}))

// ── PATCH /api/productions/:id/tasks ─────────────────────────────────────────
// Toggle a checklist task
router.patch('/:id/tasks', asyncHandler(async (req, res) => {
  const { tasks } = req.body
  if (!tasks || typeof tasks !== 'object') {
    return res.status(400).json({ error: 'Tasks inválido' })
  }
  const result = await updateTasks(req.params.id, tasks)
  res.json(result)
}))

// ── DELETE /api/productions/:id ───────────────────────────────────────────────
router.delete('/:id', asyncHandler(async (req, res) => {
  const deleted = await deleteProduction(req.params.id)
  if (!deleted) return res.status(404).json({ error: 'Producción no encontrada' })
  res.json({ success: true, id: req.params.id })
}))

export default router
