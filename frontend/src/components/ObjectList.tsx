import type { TrackedObject } from '../lib/api'
import { iconFor, placeName, statusLabel, timeAgo } from '../lib/format'
import { SnapshotPhoto } from './SnapshotPhoto'

const TONE = {
  live: 'bg-sage-50 text-sage-700',
  past: 'bg-stone-100 text-stone-600',
  warn: 'bg-amber-50 text-amber-ink',
  none: 'bg-stone-100 text-stone-500',
}

export function StatusChip({ o }: { o: TrackedObject }) {
  const { label, tone } = statusLabel(o)
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${TONE[tone]}`}>
      {tone === 'live' && <span className="size-1.5 rounded-full bg-sage-600" />}
      {label}
    </span>
  )
}

function ObjectCard({ o, now, highlighted, onOpen }: {
  o: TrackedObject
  now: number
  highlighted: boolean
  onOpen: () => void
}) {
  const Icon = iconFor(o.icon)
  const never = o.status === 'never'
  return (
    <button
      onClick={onOpen}
      className={[
        'press group flex flex-col overflow-hidden rounded-3xl border border-transparent bg-card text-left shadow-card',
        'hover:shadow-lift focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-clay-500',
        highlighted ? 'ring-3 ring-clay-500' : '',
      ].join(' ')}
    >
      <div className="relative aspect-[4/3] bg-stone-100">
        {o.snapshot ? (
          <SnapshotPhoto snapshot={o.snapshot} alt={`Last photo of your ${o.name.toLowerCase()}`} />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 text-stone-400">
            <Icon className="size-10" strokeWidth={1.5} />
            <span className="text-xs">{never ? 'No photo yet' : 'Photo not saved'}</span>
          </div>
        )}
        <span className="absolute top-3 left-3 flex size-9 items-center justify-center rounded-full bg-card/90 text-ink shadow-card backdrop-blur">
          <Icon className="size-[18px]" strokeWidth={2} />
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-serif text-xl leading-tight">{o.name}</h3>
          <StatusChip o={o} />
        </div>
        {never ? (
          <p className="text-[15px] text-muted">Not yet seen</p>
        ) : (
          <p className="text-[15px] leading-snug">
            <span className="text-muted">Last seen: </span>
            <span className="font-semibold">{placeName(o.region!)}</span>
            <br />
            <span className="text-muted">{timeAgo(o.last_seen!, now)}</span>
          </p>
        )}
      </div>
    </button>
  )
}

export function ObjectList({ objects, now, highlightId, onOpen }: {
  objects: TrackedObject[]
  now: number
  highlightId: string | null
  onOpen: (id: string) => void
}) {
  const seen = objects.filter((o) => o.seen)
  const unseen = objects.filter((o) => !o.seen)
  return (
    <div className="space-y-8">
      {seen.length === 0 && (
        <div className="rounded-3xl bg-clay-50 p-6 text-[15px] leading-relaxed text-clay-700">
          <p className="font-serif text-xl text-ink">Nothing remembered yet</p>
          <p className="mt-1">
            Put one of the items below where the camera can see it and leave it for a moment. Keepsake will
            take a photo and remember where it is.
          </p>
        </div>
      )}
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[...seen, ...unseen].map((o) => (
          <li key={o.object_id} className="flex">
            <div className="flex w-full flex-col [&>button]:flex-1">
              <ObjectCard o={o} now={now} highlighted={o.object_id === highlightId} onOpen={() => onOpen(o.object_id)} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
