import pool from './pool.js'

// ── Shape a flat DB row + related data into the frontend's production object ──
function shapeProd(row, models) {
  return {
    id: row.id,
    name: row.name,
    fabric: row.fabric,
    weightPerUnit: row.weight_per_unit,
    stage: row.stage,
    deadline: row.deadline ? row.deadline.toISOString().split('T')[0] : '',
    createdAt: row.created_at.toISOString
      ? row.created_at.toISOString().split('T')[0]
      : String(row.created_at),
    costs: {
      tela: row.cost_tela,
      estampa: row.cost_estampa,
      corte: row.cost_corte,
      avios: row.cost_avios,
    },
    tasks: row.tasks || {},
    models: models || [],
  }
}

// ── Fetch all models+variants for an array of production ids ─────────────────
async function fetchModelsForProds(prodIds) {
  if (!prodIds.length) return {}

  const modRows = await pool.query(
    `SELECT * FROM models WHERE production_id = ANY($1) ORDER BY sort_order ASC`,
    [prodIds]
  )
  const modelIds = modRows.rows.map((r) => r.id)

  let varRows = { rows: [] }
  if (modelIds.length) {
    varRows = await pool.query(
      `SELECT * FROM variants WHERE model_id = ANY($1) ORDER BY sort_order ASC`,
      [modelIds]
    )
  }

  // Group variants by model_id
  const varsByModel = {}
  for (const v of varRows.rows) {
    if (!varsByModel[v.model_id]) varsByModel[v.model_id] = []
    varsByModel[v.model_id].push({
      id: v.id,
      color: v.color,
      stamp: v.stamp,
      size: v.size,
      qty: v.qty,
    })
  }

  // Group models by production_id
  const modelsByProd = {}
  for (const m of modRows.rows) {
    if (!modelsByProd[m.production_id]) modelsByProd[m.production_id] = []
    modelsByProd[m.production_id].push({
      id: m.id,
      name: m.name,
      variants: varsByModel[m.id] || [],
    })
  }

  return modelsByProd
}

// ── GET all productions ───────────────────────────────────────────────────────
export async function getAllProductions() {
  const result = await pool.query(
    `SELECT * FROM productions ORDER BY created_at DESC, updated_at DESC`
  )
  if (!result.rows.length) return []

  const ids = result.rows.map((r) => r.id)
  const modelsByProd = await fetchModelsForProds(ids)

  return result.rows.map((row) => shapeProd(row, modelsByProd[row.id] || []))
}

// ── GET single production ─────────────────────────────────────────────────────
export async function getProduction(id) {
  const result = await pool.query(`SELECT * FROM productions WHERE id = $1`, [id])
  if (!result.rows.length) return null

  const modelsByProd = await fetchModelsForProds([id])
  return shapeProd(result.rows[0], modelsByProd[id] || [])
}

// ── INSERT production (with models + variants in one transaction) ─────────────
export async function createProduction(data) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    await client.query(
      `INSERT INTO productions
         (id, name, fabric, weight_per_unit, stage, deadline, created_at,
          cost_tela, cost_estampa, cost_corte, cost_avios, tasks, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())`,
      [
        data.id,
        data.name,
        data.fabric,
        data.weightPerUnit || 0,
        data.stage,
        data.deadline || null,
        data.createdAt,
        data.costs?.tela || 0,
        data.costs?.estampa || 0,
        data.costs?.corte || 0,
        data.costs?.avios || 0,
        JSON.stringify(data.tasks || {}),
      ]
    )

    await _upsertModels(client, data.id, data.models || [])

    await client.query('COMMIT')
    return await getProduction(data.id)
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// ── UPDATE production (full replace) ─────────────────────────────────────────
export async function updateProduction(id, data) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const result = await client.query(
      `UPDATE productions SET
         name=$1, fabric=$2, weight_per_unit=$3, stage=$4, deadline=$5,
         cost_tela=$6, cost_estampa=$7, cost_corte=$8, cost_avios=$9,
         tasks=$10, updated_at=NOW()
       WHERE id=$11 RETURNING id`,
      [
        data.name,
        data.fabric,
        data.weightPerUnit || 0,
        data.stage,
        data.deadline || null,
        data.costs?.tela || 0,
        data.costs?.estampa || 0,
        data.costs?.corte || 0,
        data.costs?.avios || 0,
        JSON.stringify(data.tasks || {}),
        id,
      ]
    )
    if (!result.rows.length) throw new Error('Production not found')

    // Full replace of models/variants
    await client.query(`DELETE FROM models WHERE production_id = $1`, [id])
    await _upsertModels(client, id, data.models || [])

    await client.query('COMMIT')
    return await getProduction(id)
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// ── PATCH stage only (fast update from detail view dropdown) ─────────────────
export async function updateStage(id, stage) {
  const result = await pool.query(
    `UPDATE productions SET stage=$1, updated_at=NOW() WHERE id=$2 RETURNING id`,
    [stage, id]
  )
  if (!result.rows.length) throw new Error('Production not found')
  return { id, stage }
}

// ── PATCH tasks only ──────────────────────────────────────────────────────────
export async function updateTasks(id, tasks) {
  const result = await pool.query(
    `UPDATE productions SET tasks=$1, updated_at=NOW() WHERE id=$2 RETURNING id`,
    [JSON.stringify(tasks), id]
  )
  if (!result.rows.length) throw new Error('Production not found')
  return { id, tasks }
}

// ── DELETE production ─────────────────────────────────────────────────────────
export async function deleteProduction(id) {
  // CASCADE handles models + variants
  const result = await pool.query(
    `DELETE FROM productions WHERE id=$1 RETURNING id`,
    [id]
  )
  return result.rows.length > 0
}

// ── Internal: insert models + variants for a production ───────────────────────
async function _upsertModels(client, productionId, models) {
  for (let mi = 0; mi < models.length; mi++) {
    const m = models[mi]
    await client.query(
      `INSERT INTO models (id, production_id, name, sort_order) VALUES ($1,$2,$3,$4)`,
      [m.id, productionId, m.name, mi]
    )
    const variants = m.variants || []
    for (let vi = 0; vi < variants.length; vi++) {
      const v = variants[vi]
      await client.query(
        `INSERT INTO variants (id, model_id, color, stamp, size, qty, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [v.id, m.id, v.color || '', v.stamp || '', v.size || '', v.qty || 0, vi]
      )
    }
  }
}
