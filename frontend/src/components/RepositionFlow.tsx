import { useEffect, useRef, useState } from 'react'
import { Check, LoaderCircle, Pause } from 'lucide-react'
import { api } from '../lib/api'
import type { Health, Region } from '../lib/api'
import { LiveFeed } from './CameraPanel'

type Rect = { name: string; x0: number; y0: number; x1: number; y1: number; map: [number, number, number, number] }

const COLORS = ['oklch(0.62 0.14 40)', 'oklch(0.55 0.1 155)', 'oklch(0.55 0.12 260)', 'oklch(0.6 0.12 80)']
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** Drag a box to move it, drag its corner to resize. Arrow keys nudge (Shift+arrows resize). */
function RegionEditor({ image, rects, onChange }: { image: string; rects: Rect[]; onChange: (r: Rect[]) => void }) {
  const box = useRef<HTMLDivElement>(null)
  const drag = useRef<{ i: number; mode: 'move' | 'resize'; px: number; py: number; start: Rect } | null>(null)

  function update(i: number, r: Rect) {
    onChange(rects.map((old, j) => (j === i ? r : old)))
  }

  function onMove(e: React.PointerEvent) {
    const d = drag.current
    if (!d || !box.current) return
    const b = box.current.getBoundingClientRect()
    const dx = (e.clientX - d.px) / b.width
    const dy = (e.clientY - d.py) / b.height
    const s = d.start
    if (d.mode === 'move') {
      const w = s.x1 - s.x0, h = s.y1 - s.y0
      const x0 = Math.min(1 - w, Math.max(0, s.x0 + dx)), y0 = Math.min(1 - h, Math.max(0, s.y0 + dy))
      update(d.i, { ...s, x0, y0, x1: x0 + w, y1: y0 + h })
    } else {
      update(d.i, { ...s, x1: Math.max(s.x0 + 0.05, clamp01(s.x1 + dx)), y1: Math.max(s.y0 + 0.05, clamp01(s.y1 + dy)) })
    }
  }

  function onKey(i: number, e: React.KeyboardEvent) {
    const step = 0.01
    const k = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key]
    if (!k) return
    e.preventDefault()
    const r = rects[i]
    if (e.shiftKey) {
      update(i, { ...r, x1: Math.max(r.x0 + 0.05, clamp01(r.x1 + k[0])), y1: Math.max(r.y0 + 0.05, clamp01(r.y1 + k[1])) })
    } else {
      const w = r.x1 - r.x0, h = r.y1 - r.y0
      const x0 = Math.min(1 - w, Math.max(0, r.x0 + k[0])), y0 = Math.min(1 - h, Math.max(0, r.y0 + k[1]))
      update(i, { ...r, x0, y0, x1: x0 + w, y1: y0 + h })
    }
  }

  return (
    <div
      ref={box}
      className="relative touch-none overflow-hidden rounded-2xl select-none"
      onPointerMove={onMove}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
    >
      <img src={image} alt="Still photo from the camera's new position" className="block h-auto w-full" draggable={false} />
      {rects.map((r, i) => (
        <div
          key={r.name}
          role="group"
          tabIndex={0}
          aria-label={`${r.name} area. Arrow keys move it, Shift plus arrow keys resize it.`}
          onKeyDown={(e) => onKey(i, e)}
          onPointerDown={(e) => {
            (e.currentTarget.parentElement as HTMLElement).setPointerCapture(e.pointerId)
            drag.current = { i, mode: 'move', px: e.clientX, py: e.clientY, start: r }
          }}
          className="absolute cursor-move rounded-xl border-3 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white"
          style={{
            left: `${r.x0 * 100}%`, top: `${r.y0 * 100}%`, width: `${(r.x1 - r.x0) * 100}%`, height: `${(r.y1 - r.y0) * 100}%`,
            borderColor: COLORS[i % COLORS.length], background: `color-mix(in oklch, ${COLORS[i % COLORS.length]} 18%, transparent)`,
          }}
        >
          <span className="absolute top-1.5 left-1.5 rounded-full px-2.5 py-0.5 text-sm font-semibold text-white" style={{ background: COLORS[i % COLORS.length] }}>
            {r.name}
          </span>
          <span
            aria-hidden
            onPointerDown={(e) => {
              e.stopPropagation()
              ;((e.currentTarget.parentElement as HTMLElement).parentElement as HTMLElement).setPointerCapture(e.pointerId)
              drag.current = { i, mode: 'resize', px: e.clientX, py: e.clientY, start: r }
            }}
            className="absolute right-1 bottom-1 size-7 cursor-nwse-resize rounded-full border-3 border-white shadow-card"
            style={{ background: COLORS[i % COLORS.length] }}
          />
        </div>
      ))}
    </div>
  )
}

export function RepositionFlow({ health, regions, onRegions, onClose }: {
  health: Health
  regions: Region[]
  onRegions: (r: Region[]) => void
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [rects, setRects] = useState<Rect[]>(() => regions.map((r) => ({ ...r })))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mode = health.mode

  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal()
  }, [])

  useEffect(() => {
    if (mode === 'MONITORING') onClose()
  }, [mode, onClose])

  async function step(fn: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const saveRegions = () =>
    step(async () => {
      const saved = await api.saveRegions(rects.map((r) => ({ name: r.name, camera: [r.x0, r.y0, r.x1, r.y1], map: r.map })))
      onRegions(saved)
    })

  const btn = 'press flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-base font-semibold disabled:opacity-50'

  return (
    <dialog
      ref={dialog}
      onCancel={(e) => e.preventDefault()} // leaving mid-calibration would leave monitoring paused
      aria-labelledby="repo-title"
      className="enter m-auto max-h-[94dvh] w-[min(820px,calc(100vw-24px))] overflow-y-auto overscroll-contain rounded-[28px] bg-card p-0 text-ink shadow-lift backdrop:bg-stone-900/50 backdrop:backdrop-blur-sm"
    >
      <div className="space-y-4 p-5 sm:p-7">
        <div className="flex items-center gap-2 text-sm font-medium text-amber-ink">
          <Pause className="size-4" /> Monitoring paused · no memories are updated while you do this
        </div>

        {mode === 'REPOSITIONING' && (
          <>
            <h2 id="repo-title" className="font-serif text-2xl">Move your camera</h2>
            <p className="text-[15px] text-muted">
              Point the camera where you want it. Nothing that happens now will count as items moving. When it's in place
              and still, press Finish Repositioning.
            </p>
            <LiveFeed health={health} className="aspect-video rounded-2xl" />
            <div className="flex flex-wrap gap-3">
              <button disabled={busy} onClick={() => step(() => api.reposition('finish'))} className={`${btn} bg-clay-600 text-white hover:bg-clay-700`}>
                Finish Repositioning
              </button>
              <button disabled={busy} onClick={() => step(() => api.reposition('cancel'))} className={`${btn} bg-stone-100 hover:bg-stone-200`}>
                I didn't move it
              </button>
            </div>
          </>
        )}

        {mode === 'CALIBRATING' && !health.reference_ready && (
          <>
            <h2 id="repo-title" className="font-serif text-2xl">Hold still for a moment…</h2>
            <p className="flex items-center gap-2 text-[15px] text-muted">
              <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" /> Waiting for a steady view to take a reference photo.
            </p>
            <LiveFeed health={health} className="aspect-video rounded-2xl" />
          </>
        )}

        {mode === 'CALIBRATING' && health.reference_ready && (
          <>
            <h2 id="repo-title" className="font-serif text-2xl">Mark where your furniture is</h2>
            <p className="text-[15px] text-muted">
              Drag each box over the matching furniture in this new view, and drag the round corner to resize it.
            </p>
            <RegionEditor image={`${api.referenceUrl}?v=${health.view_id}`} rects={rects} onChange={setRects} />
            <div className="flex flex-wrap gap-3">
              <button disabled={busy} onClick={saveRegions} className={`${btn} bg-clay-600 text-white hover:bg-clay-700`}>
                <Check className="size-5" /> Save areas
              </button>
            </div>
          </>
        )}

        {mode === 'READY_TO_RESUME' && (
          <>
            <h2 id="repo-title" className="font-serif text-2xl">All set</h2>
            <p className="text-[15px] text-muted">
              Your areas are saved. Earlier photos and locations are kept. Items will be re-checked from the new view
              without counting as moves.
            </p>
            <div className="flex flex-wrap gap-3">
              <button disabled={busy} onClick={() => step(() => api.reposition('resume'))} className={`${btn} bg-clay-600 text-white hover:bg-clay-700`}>
                Resume monitoring
              </button>
            </div>
          </>
        )}

        {error && <p className="rounded-2xl bg-amber-50 p-3 text-[15px] text-amber-ink">{error}</p>}
      </div>
    </dialog>
  )
}
