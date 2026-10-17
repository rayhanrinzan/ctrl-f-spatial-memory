import { useState } from 'react'
import { CameraOff, Move } from 'lucide-react'
import { api } from '../lib/api'
import type { Health } from '../lib/api'

export function LiveFeed({ health, className = '' }: { health: Health | null; className?: string }) {
  const [streamKey, setStreamKey] = useState(0)
  const active = health?.camera === 'active'
  return (
    <div className={`relative overflow-hidden bg-stone-900 ${className}`}>
      {active ? (
        <img
          key={streamKey}
          src={`${api.cameraUrl}?k=${streamKey}`}
          onError={() => setTimeout(() => setStreamKey((k) => k + 1), 2000)}
          alt="Live camera view with detected items outlined"
          className="size-full object-contain"
        />
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-2 p-4 text-center text-sm text-stone-300">
          <CameraOff className="size-6" />
          <p>{!health ? 'Connecting to Keepsake…' : health.camera === 'disabled' ? 'Camera is turned off' : health.error ?? 'Starting camera…'}</p>
        </div>
      )}
    </div>
  )
}

export function CameraPanel({ health, onReposition }: { health: Health | null; onReposition: () => void }) {
  const active = health?.camera === 'active'
  return (
    <section className="overflow-hidden rounded-3xl bg-card shadow-card">
      <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-3">
        <h2 className="font-serif text-lg">Camera</h2>
        <button
          onClick={onReposition}
          disabled={!health || health.camera === 'disabled'}
          className="press flex min-h-10 items-center gap-1.5 rounded-full bg-stone-100 px-3.5 text-sm font-medium hover:bg-stone-200 disabled:opacity-50"
        >
          <Move className="size-4" /> Reposition
        </button>
      </div>
      <LiveFeed health={health} className="aspect-video" />
      {health?.warning && <p className="bg-amber-50 px-5 py-2.5 text-sm text-amber-ink">{health.warning}</p>}
      {active && (
        <div className="flex min-h-11 flex-wrap items-center gap-1.5 px-5 py-3">
          {health.detections.length === 0 ? (
            <span className="text-sm text-muted">No tracked items in view</span>
          ) : (
            health.detections.map((d, i) => (
              <span key={i} className="rounded-full bg-sage-50 px-2.5 py-1 text-xs font-medium text-sage-700">
                {d.name} · {Math.round(d.confidence * 100)}%
              </span>
            ))
          )}
        </div>
      )}
    </section>
  )
}
