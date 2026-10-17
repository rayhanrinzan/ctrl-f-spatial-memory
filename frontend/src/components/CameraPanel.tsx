import { useState } from 'react'
import { CameraOff } from 'lucide-react'
import { api } from '../lib/api'
import type { Health } from '../lib/api'

export function CameraPanel({ health }: { health: Health | null }) {
  const [streamKey, setStreamKey] = useState(0)
  const active = health?.camera === 'active'

  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-sm font-medium text-zinc-300">Live camera</h2>
        <span className="text-xs text-zinc-500">{active ? `${health?.fps ?? 0} fps · on-device` : ''}</span>
      </div>
      <div className="relative aspect-video bg-black">
        {active ? (
          <img
            key={streamKey}
            src={`${api.cameraUrl}?k=${streamKey}`}
            onError={() => setTimeout(() => setStreamKey((k) => k + 1), 2000)}
            alt="Live camera with detections"
            className="size-full object-contain"
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 p-4 text-center text-sm text-zinc-500">
            <CameraOff className="size-6" />
            <p>{health ? health.error ?? `Camera ${health.camera}` : 'Connecting to server…'}</p>
          </div>
        )}
      </div>
      {active && health.warning && (
        <p className="border-t border-zinc-800 px-4 py-2 text-xs text-amber-300">{health.warning}</p>
      )}
      {active && (
        <div className="flex min-h-10 flex-wrap gap-1.5 px-4 py-2.5">
          {health.detections.length === 0 ? (
            <span className="text-xs text-zinc-500">No tracked objects in view</span>
          ) : (
            health.detections.map((d, i) => (
              <span key={i} className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300">
                {d.category} · {Math.round(d.confidence * 100)}%
              </span>
            ))
          )}
        </div>
      )}
    </section>
  )
}
