// Central API client — all requests go through here
// In production, same origin. In dev, Vite proxies /api → localhost:3001

const BASE = '/api'

async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body !== undefined) {
    opts.body = JSON.stringify(body)
  }

  const res = await fetch(`${BASE}${path}`, opts)

  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try {
      const json = await res.json()
      msg = json.error || msg
    } catch {}
    throw new Error(msg)
  }

  // 204 No Content
  if (res.status === 204) return null
  return res.json()
}

export const api = {
  productions: {
    list:        ()         => request('GET',    '/productions'),
    get:         (id)       => request('GET',    `/productions/${id}`),
    create:      (data)     => request('POST',   '/productions', data),
    update:      (id, data) => request('PUT',    `/productions/${id}`, data),
    updateStage: (id, stage)=> request('PATCH',  `/productions/${id}/stage`, { stage }),
    updateTasks: (id, tasks)=> request('PATCH',  `/productions/${id}/tasks`, { tasks }),
    delete:      (id)       => request('DELETE', `/productions/${id}`),
  },
}
