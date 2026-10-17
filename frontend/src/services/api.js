const API_BASE = '/api/v1'
const API_KEY = 'fortebank-datathon-2026-secret-key'

const authHeaders = {
  'X-API-Key': API_KEY,
}

export async function checkHealth() {
  const res = await fetch(`${API_BASE}/health`)
  if (!res.ok) throw new Error(`Healthcheck failed: ${res.statusText}`)
  return res.json()
}

export async function fetchRegulations() {
  const res = await fetch(`${API_BASE}/regulations`, {
    headers: authHeaders,
  })
  if (!res.ok) throw new Error(`Failed to load regulations: ${res.statusText}`)
  return res.json()
}

export async function submitVideoAnalysis(file, { startSec, endSec, saveTrimmedOnly } = {}) {
  const formData = new FormData()
  formData.append('file', file)
  if (startSec !== undefined && startSec !== null && startSec !== '') {
    formData.append('start_sec', String(startSec))
  }
  if (endSec !== undefined && endSec !== null && endSec !== '') {
    formData.append('end_sec', String(endSec))
  }
  if (saveTrimmedOnly) {
    formData.append('save_trimmed_only', 'true')
  }

  const res = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    headers: authHeaders,
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Submission failed (${res.status})`)
  }
  return res.json()
}

export async function pollJobDetailed(jobId) {
  const res = await fetch(`${API_BASE}/jobs/${jobId}/detailed`, {
    headers: authHeaders,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Polling failed (${res.status})`)
  }
  return res.json()
}

export async function compileVideoCuts(file, cuts, drawBbox = true) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('cuts', JSON.stringify(cuts))
  formData.append('draw_bbox', String(drawBbox))

  const res = await fetch(`${API_BASE}/videos/compile-cuts`, {
    method: 'POST',
    headers: authHeaders,
    body: formData,
  })
  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(err || `Compilation failed (${res.status})`)
  }
  return res.blob()
}
