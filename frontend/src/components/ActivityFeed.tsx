import { ArrowRight, History } from 'lucide-react'
import type { MoveEvent } from '../lib/api'
import { clockTime } from '../lib/format'

export function ActivityFeed({ events }: { events: MoveEvent[] }) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-300">
        <History className="size-4 text-zinc-500" /> Recent activity
      </h2>
      {events.length === 0 ? (
        <p className="text-sm text-zinc-500">No movements recorded yet.</p>
      ) : (
        <ul className="space-y-2.5">
          {events.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="font-medium">{e.name}</span>
                {e.from_region ? (
                  <>
                    <span className="text-zinc-400">moved from {e.from_region}</span>
                    <ArrowRight className="size-3.5 text-zinc-500" />
                    <span className="text-emerald-300">{e.to_region}</span>
                  </>
                ) : (
                  <span className="text-zinc-400">
                    first seen on the <span className="text-emerald-300">{e.to_region}</span>
                  </span>
                )}
              </span>
              <time className="shrink-0 text-xs text-zinc-500">{clockTime(e.timestamp)}</time>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
