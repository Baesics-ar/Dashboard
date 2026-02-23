// Basic validation for production payloads
export function validateProduction(req, res, next) {
  const data = req.body

  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
    return res.status(400).json({ error: 'El nombre de la producción es requerido' })
  }
  if (!data.id || typeof data.id !== 'string') {
    return res.status(400).json({ error: 'ID inválido' })
  }
  if (!data.stage) {
    return res.status(400).json({ error: 'El estado es requerido' })
  }
  if (!data.createdAt) {
    return res.status(400).json({ error: 'La fecha de creación es requerida' })
  }
  if (!Array.isArray(data.models)) {
    return res.status(400).json({ error: 'Los modelos deben ser un array' })
  }

  next()
}

// Generic async error wrapper — avoids try/catch in every route
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}
