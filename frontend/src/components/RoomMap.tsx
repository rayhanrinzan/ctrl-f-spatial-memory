import type { Region, TrackedObject } from '../lib/api'
import { iconFor } from '../lib/format'

interface Props {
  regions: Region[]
  objects: TrackedObject[]
  highlightId: string | null
  onOpen: (id: string) => void
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Approximate spot on the blueprint: the object's place inside its camera region, mapped into that region's box. */
function mapPosition(o: TrackedObject, regions: Region[]) {
  const r = regions.find((r) => r.name === o.region)
  if (!r || o.x == null || o.y == null) return null
  const rx = clamp((o.x - r.x0) / (r.x1 - r.x0), 0.18, 0.82)
  const ry = clamp((o.y - r.y0) / (r.y1 - r.y0), 0.45, 0.62)
  const [mx0, my0, mx1, my1] = r.map
  return { left: (mx0 + rx * (mx1 - mx0)) * 100, top: (my0 + ry * (my1 - my0)) * 100 }
}

/** Nudge markers sideways so items remembered at nearly the same spot don't hide each other. */
function spread<T extends { pos: { left: number; top: number } | null }>(items: T[]): T[] {
  const taken: { left: number; top: number }[] = []
  return items.map((it) => {
    const pos = { ...it.pos! }
    for (let i = 0; i < 8 && taken.some((p) => Math.abs(p.left - pos.left) < 11 && Math.abs(p.top - pos.top) < 10); i++) {
      pos.left += pos.left > 80 ? -11 : 11
    }
    taken.push(pos)
    return { ...it, pos }
  })
}

function Furniture({ r }: { r: Region }) {
  const [x0, y0, x1, y1] = r.map
  const style = { left: `${x0 * 100}%`, top: `${y0 * 100}%`, width: `${(x1 - x0) * 100}%`, height: `${(y1 - y0) * 100}%` }
  const isBed = r.name.toLowerCase() === 'bed'
  return (
    <div style={style} className="absolute rounded-2xl border-2 border-stone-300 bg-card/70">
      {isBed && (
        <div className="absolute inset-x-[8%] top-[18%] flex h-[16%] gap-[4%]">
          <div className="flex-1 rounded-lg bg-stone-200/80" />
          <div className="flex-1 rounded-lg bg-stone-200/80" />
        </div>
      )}
      <span className="absolute top-2.5 left-3.5 font-serif text-[15px] text-stone-500">{r.name}</span>
    </div>
  )
}

export function RoomMap({ regions, objects, highlightId, onOpen }: Props) {
  const placed = spread(objects.map((o) => ({ o, pos: mapPosition(o, regions) })).filter((p) => p.pos))
  const elsewhere = objects.filter((o) => o.seen && !mapPosition(o, regions))
  const unseen = objects.filter((o) => !o.seen)

  return (
    <div className="space-y-4">
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[28px] bg-[oklch(0.955_0.012_75)] shadow-card">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(oklch(0.5 0.03 60 / .07) 1px, transparent 1px), linear-gradient(90deg, oklch(0.5 0.03 60 / .07) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        <div aria-hidden className="absolute inset-[2%] rounded-[22px] border-[3px] border-stone-400/70" />
        <div aria-hidden className="absolute bottom-[1.2%] left-[12%] h-[2%] w-[14%] bg-[oklch(0.955_0.012_75)]" />
        <span className="absolute bottom-[3.6%] left-[14.5%] text-xs tracking-wide text-stone-400">Door</span>

        {regions.map((r) => <Furniture key={r.name} r={r} />)}

        {placed.map(({ o, pos }) => {
          const Icon = iconFor(o.icon)
          const highlighted = o.object_id === highlightId
          const tone = o.awaiting_reconfirmation
            ? 'border-dashed border-amber-ink/60 bg-amber-50 text-amber-ink'
            : o.visible
              ? 'border-transparent bg-clay-500 text-white shadow-lift'
              : 'border-dashed border-stone-400 bg-card text-stone-600'
          return (
            <button
              key={o.object_id}
              onClick={() => onOpen(o.object_id)}
              style={{ left: `${pos!.left}%`, top: `${pos!.top}%` }}
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2 transition-[left,top] duration-700 ease-out motion-reduce:transition-none"
              aria-label={`${o.name}: last seen on the ${o.region}${o.visible ? ', in view now' : ', out of view'}`}
            >
              {highlighted && <span className="pulse-ring absolute inset-0 rounded-full bg-clay-500/50" />}
              <span className={`press relative flex size-9 items-center justify-center rounded-full border-2 sm:size-12 lg:size-14 ${tone} ${highlighted ? 'ring-4 ring-clay-500/40' : ''}`}>
                <Icon className="size-[18px] sm:size-6" strokeWidth={2} />
              </span>
              <span className={`absolute top-full ${highlighted ? "" : "hidden sm:block"} left-1/2 mt-1 -translate-x-1/2 rounded-full bg-card px-1.5 py-0.5 text-[11px] sm:text-xs font-medium whitespace-nowrap shadow-card`}>
                {o.name}
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
        <span className="flex items-center gap-2"><span className="size-3 rounded-full bg-clay-500" /> In view now</span>
        <span className="flex items-center gap-2"><span className="size-3 rounded-full border-2 border-dashed border-stone-400" /> Last seen (out of view)</span>
        <span className="flex items-center gap-2"><span className="size-3 rounded-full border-2 border-dashed border-amber-ink/60 bg-amber-50" /> Before camera moved</span>
        <span className="text-stone-400">Positions are approximate.</span>
      </div>

      {(elsewhere.length > 0 || unseen.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {[...elsewhere, ...unseen].map((o) => {
            const Icon = iconFor(o.icon)
            return (
              <button
                key={o.object_id}
                onClick={() => onOpen(o.object_id)}
                className="press flex items-center gap-2 rounded-full bg-card px-3 py-2 text-sm shadow-card hover:bg-stone-50"
              >
                <Icon className="size-4 text-stone-500" />
                {o.name}
                <span className="text-muted">· {o.seen ? 'elsewhere in the room' : 'not yet seen'}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
