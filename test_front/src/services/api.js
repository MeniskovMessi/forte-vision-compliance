const API_BASE = '/api/v1'
const API_KEY = 'fortebank-secret-key-2026'

const authHeaders = {
  'X-API-Key': API_KEY,
}

export async function checkHealth() {
  const res = await fetch(`${API_BASE}/health`)
  if (!res.ok) throw new Error(`Healthcheck failed: ${res.statusText}`)
  return res.json()
}

export async function fetchRegulations() {
  const res = await fetch(`${API_BASE}/regulations`)
  if (!res.ok) throw new Error(`Failed to load regulations: ${res.statusText}`)
  return res.json()
}

export async function inspectVideoFile(file) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${API_BASE}/videos/inspect`, {
    method: 'POST',
    headers: authHeaders,
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Inspection failed (${res.status})`)
  }
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

export async function listJobs(limit = 30) {
  const res = await fetch(`${API_BASE}/jobs?limit=${limit}`, {
    headers: authHeaders,
  })
  if (!res.ok) throw new Error(`Failed to list jobs: ${res.statusText}`)
  return res.json()
}

export function getVideoStreamUrl(jobId) {
  return `${API_BASE}/videos/${jobId}/stream`
}

export function getEvidenceFrameUrl(jobId, timestampSec, drawBbox = false) {
  return `${API_BASE}/jobs/${jobId}/evidence/frame?timestamp_sec=${timestampSec}&draw_bbox=${drawBbox}`
}

export function getEvidenceClipUrl(jobId, timecodeSec, padSec = 3.0, drawBbox = false) {
  return `${API_BASE}/jobs/${jobId}/evidence/clip?timecode_sec=${timecodeSec}&pad_sec=${padSec}&draw_bbox=${drawBbox}`
}

export async function compileEvidenceCuts(jobId, { violationIndices, cuts, drawBbox = true } = {}) {
  const res = await fetch(`${API_BASE}/jobs/${jobId}/evidence/compile`, {
    method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      violation_indices: violationIndices || [],
      cuts: cuts || [],
      draw_bbox: drawBbox,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Compilation failed (${res.status})`)
  }
  return res.json()
}
