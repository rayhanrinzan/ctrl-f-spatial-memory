export interface TrackedObject {
  object_id: string
  category: string
  name: string
  region: string | null
  x: number | null
  y: number | null
  last_seen: string
  visible: boolean
  confidence: number | null
  track_id: number | null
}

export interface MoveEvent {
  id: number
  object_id: string
  name: string
  from_region: string | null
  to_region: string
  timestamp: string
}

export interface Region {
  name: string
  x0: number
  y0: number
  x1: number
  y1: number
  map: [number, number, number, number]
}

export interface Health {
  status: string
  camera: 'starting' | 'active' | 'error' | 'stopped' | 'disabled'
  error: string | null
  warning?: string | null
  fps: number
  detections: { category: string; confidence: number; track_id: number | null }[]
  supported: string[]
}

export interface QueryResult {
  found: boolean
  answer: string
  object: TrackedObject | null
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, init)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

export const api = {
  health: () => req<Health>('/health'),
  regions: () => req<Region[]>('/regions'),
  objects: () => req<TrackedObject[]>('/objects'),
  events: (limit = 20) => req<MoveEvent[]>(`/events?limit=${limit}`),
  query: (text: string) =>
    req<QueryResult>('/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }),
  clear: () => req<{ cleared: boolean }>('/memory', { method: 'DELETE' }),
  cameraUrl: '/api/camera',
}
