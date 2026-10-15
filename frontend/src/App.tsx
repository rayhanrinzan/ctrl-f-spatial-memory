import { useCallback, useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { api } from './lib/api'
import type { Health, MoveEvent, QueryResult, Region, TrackedObject } from './lib/api'
import { RoomMap } from './components/RoomMap'
import { SearchPanel } from './components/SearchPanel'
import { CameraPanel } from './components/CameraPanel'
import { ActivityFeed } from './components/ActivityFeed'

const POLL_MS = 1000

function StatusPill({ health, offline }: { health: Health | null; offline: boolean }) {
  const cam = health?.camera
  const [label, dot] = offline
    ? ['Server offline', 'bg-rose-500']
    : cam === 'active'
      ? ['Camera active', 'bg-emerald-400']
      : cam === 'disabled'
        ? ['Camera off', 'bg-zinc-500']
        : cam === 'error'
          ? ['Camera unavailable', 'bg-amber-400']
          : ['Connecting…', 'bg-zinc-500']
  return (
    <span className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300">
      <span className="relative flex size-2">
        {cam === 'active' && !offline && <span className="ping-ring absolute inset-0 rounded-full bg-emerald-400" />}
        <span className={`relative size-2 rounded-full ${dot}`} />
      </span>
      {label}
    </span>
  )
}

export default function App() {
  const [health, setHealth] = useState<Health | null>(null)
  const [offline, setOffline] = useState(false)
  const [regions, setRegions] = useState<Region[]>([])
  const [objects, setObjects] = useState<TrackedObject[]>([])
  const [events, setEvents] = useState<MoveEvent[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())

  const refresh = useCallback(async () => {
    try {
      const [h, o, e] = await Promise.all([api.health(), api.objects(), api.events(15)])
      setHealth(h)
      setObjects(o)
      setEvents(e)
      setOffline(false)
    } catch {
      setOffline(true)
    }
    setNow(Date.now())
  }, [])

  useEffect(() => {
    api.regions().then(setRegions).catch(() => setOffline(true))
    refresh()
    const id = setInterval(refresh, POLL_MS)
    return () => clearInterval(id)
  }, [refresh])

  useEffect(() => {
    if (!highlightId) return
    const t = setTimeout(() => setHighlightId(null), 6000)
    return () => clearTimeout(t)
  }, [highlightId])

  function onQuery(r: QueryResult) {
    if (r.object) {
      setHighlightId(r.object.object_id)
      setSelectedId(r.object.object_id)
    }
  }

  async function clearMemory() {
    if (!confirm('Forget all remembered object locations and movement history?')) return
    await api.clear().catch(() => setOffline(true))
    setSelectedId(null)
    refresh()
  }

  const visibleCount = objects.filter((o) => o.visible).length

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Ctrl<span className="text-emerald-400">+</span>F
          </h1>
          <p className="text-sm text-zinc-400">Your room remembers, so you don't have to.</p>
        </div>
        <StatusPill health={health} offline={offline} />
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <SearchPanel onResult={onQuery} />
          <section>
            <div className="mb-2 flex items-end justify-between">
              <h2 className="text-sm font-medium text-zinc-300">Room map</h2>
              <span className="text-xs text-zinc-500">
                {objects.length} remembered · {visibleCount} in view
              </span>
            </div>
            <RoomMap
              regions={regions}
              objects={objects}
              selectedId={selectedId}
              highlightId={highlightId}
              onSelect={setSelectedId}
              now={now}
            />
            <div className="mt-2 flex items-center gap-4 text-xs text-zinc-500">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-emerald-500" /> Visible now
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full border border-dashed border-zinc-400 bg-zinc-800" /> Last seen
              </span>
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <CameraPanel health={health} />
          <ActivityFeed events={events} />
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 text-xs leading-relaxed text-zinc-500">
            Video is processed on this computer and never saved. Only object names, positions and times are stored.
            <button
              onClick={clearMemory}
              className="mt-3 flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-zinc-300 hover:border-rose-500/60 hover:text-rose-300"
            >
              <Trash2 className="size-3.5" /> Clear memory
            </button>
          </section>
        </aside>
      </div>
    </div>
  )
}
