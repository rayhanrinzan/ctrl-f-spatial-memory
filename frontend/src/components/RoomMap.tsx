import { Eye, EyeOff, X } from 'lucide-react'
import type { Region, TrackedObject } from '../lib/api'
import { iconFor, timeAgo } from '../lib/format'

interface Props {
  regions: Region[]
  objects: TrackedObject[]
  selectedId: string | null
  highlightId: string | null
  onSelect: (id: string | null) => void
  now: number
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Position on the blueprint: the object's spot inside its camera region, mapped into that region's map box. */
function mapPosition(o: TrackedObject, regions: Region[]) {
  const r = regions.find((r) => r.name === o.region)
  if (!r || o.x == null || o.y == null) return null
  const rx = clamp((o.x - r.x0) / (r.x1 - r.x0), 0.18, 0.82)
  const ry = clamp((o.y - r.y0) / (r.y1 - r.y0), 0.45, 0.62)
  const [mx0, my0, mx1, my1] = r.map
  return { left: (mx0 + rx * (mx1 - mx0)) * 100, top: (my0 + ry * (my1 - my0)) * 100 }
}

function Furniture({ r }: { r: Region }) {
  const [x0, y0, x1, y1] = r.map
  const style = { left: `${x0 * 100}%`, top: `${y0 * 100}%`, width: `${(x1 - x0) * 100}%`, height: `${(y1 - y0) * 100}%` }
  const isBed = r.name.toLowerCase() === 'bed'
  return (
    <div style={style} className="absolute rounded-xl border border-sky-400/25 bg-sky-400/[0.04]">
      {isBed && (
        <div className="absolute inset-x-[8%] top-[16%] flex h-[16%] gap-[4%]">
          <div className="flex-1 rounded-md border border-sky-400/15 bg-sky-400/[0.05]" />
          <div className="flex-1 rounded-md border border-sky-400/15 bg-sky-400/[0.05]" />
        </div>
      )}
      <span className="absolute top-2 left-3 text-[11px] font-medium tracking-[0.14em] text-sky-200/50 uppercase">
        {r.name}
      </span>
    </div>
  )
}

export function RoomMap({ regions, objects, selectedId, highlightId, onSelect, now }: Props) {
  const selected = objects.find((o) => o.object_id === selectedId)
  const placed = objects.map((o) => ({ o, pos: mapPosition(o, regions) })).filter((p) => p.pos)

  return (
    <div
      className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900"
      onClick={() => onSelect(null)}
    >
      {/* blueprint grid */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            'linear-gradient(rgba(56,189,248,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,.06) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />
      {/* walls + door */}
      <div className="absolute inset-[2%] rounded-xl border-2 border-zinc-600/70" />
      <div className="absolute bottom-[1.4%] left-[12%] h-[1.6%] w-[14%] bg-zinc-900" />
      <span className="absolute bottom-[3.5%] left-[14%] text-[10px] tracking-widest text-zinc-500 uppercase">Door</span>

      {regions.map((r) => (
        <Furniture key={r.name} r={r} />
      ))}

      {placed.map(({ o, pos }) => {
        const Icon = iconFor(o.category)
        const active = o.object_id === selectedId || o.object_id === highlightId
        return (
          <button
            key={o.object_id}
            onClick={(e) => {
              e.stopPropagation()
              onSelect(o.object_id === selectedId ? null : o.object_id)
            }}
            style={{ left: `${pos!.left}%`, top: `${pos!.top}%` }}
            className="absolute z-10 -translate-x-1/2 -translate-y-1/2 transition-[left,top] duration-700 ease-out"
            aria-label={`${o.name} on the ${o.region}`}
          >
            {o.object_id === highlightId && (
              <span className="ping-ring absolute inset-0 rounded-full bg-amber-400/60" />
            )}
            <span
              className={[
                'relative flex size-10 items-center justify-center rounded-full border-2 shadow-lg transition sm:size-12',
                o.visible
                  ? 'border-emerald-300 bg-emerald-500 text-emerald-950 shadow-emerald-500/30'
                  : 'border-dashed border-zinc-400 bg-zinc-800 text-zinc-300',
                active ? 'scale-110 ring-4 ring-amber-400/60' : 'hover:scale-105',
              ].join(' ')}
            >
              <Icon className="size-5 sm:size-6" strokeWidth={2.2} />
            </span>
            <span className="absolute top-full left-1/2 mt-1 -translate-x-1/2 rounded bg-zinc-950/80 px-1.5 py-0.5 text-[11px] whitespace-nowrap text-zinc-200">
              {o.name}
            </span>
          </button>
        )
      })}

      {objects.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-zinc-500">
          Nothing remembered yet. Place a bottle, cup, phone, book or backpack in view of the camera.
        </div>
      )}

      {selected && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-3 bottom-3 z-20 w-60 rounded-xl border border-zinc-700 bg-zinc-950/95 p-4 shadow-2xl backdrop-blur"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="font-semibold">{selected.name}</div>
              <div className="text-sm text-zinc-400">Last seen on the {selected.region}</div>
            </div>
            <button onClick={() => onSelect(null)} className="text-zinc-500 hover:text-zinc-200" aria-label="Close">
              <X className="size-4" />
            </button>
          </div>
          <dl className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-zinc-500">Last seen</dt>
              <dd>{timeAgo(selected.last_seen, now)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Status</dt>
              <dd className={`flex items-center gap-1 ${selected.visible ? 'text-emerald-400' : 'text-zinc-400'}`}>
                {selected.visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                {selected.visible ? 'Visible now' : 'Out of view'}
              </dd>
            </div>
            {selected.confidence != null && (
              <div className="flex justify-between">
                <dt className="text-zinc-500">Confidence</dt>
                <dd>{Math.round(selected.confidence * 100)}%</dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </div>
  )
}
