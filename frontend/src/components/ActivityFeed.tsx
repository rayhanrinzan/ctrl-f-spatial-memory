import type { MoveEvent } from '../lib/api'
import { clockTime, placeName } from '../lib/format'

function describe(e: MoveEvent) {
  if (e.event_type === 'first_seen' || !e.from_region) return <>first noticed on the <b>{placeName(e.to_region)}</b></>
  if (e.event_type === 'moved_within') return <>moved to a new spot on the <b>{placeName(e.to_region)}</b></>
  return <>moved from {placeName(e.from_region)} to the <b>{placeName(e.to_region)}</b></>
}

export function ActivityFeed({ events }: { events: MoveEvent[] }) {
  return (
    <section className="rounded-3xl bg-card p-5 shadow-card">
      <h2 className="mb-3 font-serif text-lg">Recent activity</h2>
      {events.length === 0 ? (
        <p className="text-[15px] text-muted">No movements recorded yet.</p>
      ) : (
        <ul className="space-y-3">
          {events.map((e) => (
            <li key={e.id} className="flex items-baseline justify-between gap-3 text-[15px] leading-snug">
              <span><span className="font-semibold">{e.name}</span> {describe(e)}</span>
              <time className="shrink-0 text-sm text-muted tabular-nums">{clockTime(e.timestamp)}</time>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
