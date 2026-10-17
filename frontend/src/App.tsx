import { useCallback, useEffect, useState } from 'react'
import { LayoutGrid, Map as MapIcon } from 'lucide-react'
import { api } from './lib/api'
import type { Health, MoveEvent, QueryResult, Region, TrackedObject } from './lib/api'
import { ObjectList } from './components/ObjectList'
import { ObjectDetail } from './components/ObjectDetail'
import { RoomMap } from './components/RoomMap'
import { SearchPanel } from './components/SearchPanel'
import { CameraPanel } from './components/CameraPanel'
import { ActivityFeed } from './components/ActivityFeed'
import { PrivacyPanel } from './components/PrivacyPanel'
import { RepositionFlow } from './components/RepositionFlow'

const POLL_MS = 1500
type View = 'list' | 'map'

function readView(): View {
  try {
    return localStorage.getItem('keepsake.view') === 'map' ? 'map' : 'list'
  } catch {
    return 'list'
  }
}

function StatusPill({ health, offline }: { health: Health | null; offline: boolean }) {
  const paused = health && health.mode !== 'MONITORING'
  const [label, dot] = offline
    ? ['Keepsake is offline', 'bg-red-500']
    : !health ? ['Connecting…', 'bg-stone-400']
      : paused ? ['Monitoring paused', 'bg-amber-500']
        : health.camera === 'active' ? ['Camera on · watching', 'bg-sage-600']
          : health.camera === 'disabled' ? ['Camera off', 'bg-stone-400']
            : ['Camera unavailable', 'bg-amber-500']
  return (
    <span role="status" className="flex items-center gap-2 rounded-full bg-card px-3.5 py-2 text-sm font-medium shadow-card">
      <span className="relative flex size-2.5">
        {health?.camera === 'active' && !paused && !offline && <span className="pulse-ring absolute inset-0 rounded-full bg-sage-600" />}
        <span className={`relative size-2.5 rounded-full ${dot}`} />
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
  const [view, setView] = useState<View>(readView)
  const [openId, setOpenId] = useState<string | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [repositioning, setRepositioning] = useState(false)
  const [now, setNow] = useState(Date.now())

  const refresh = useCallback(async () => {
    try {
      const [h, o, e] = await Promise.all([api.health(), api.objects(), api.events(12)])
      setHealth(h)
      setObjects(o)
      setEvents(e)
      setOffline(false)
      if (h.mode !== 'MONITORING') setRepositioning(true)
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
    try {
      localStorage.setItem('keepsake.view', view)
    } catch {
      /* storage unavailable */
    }
  }, [view])

  useEffect(() => {
    if (!highlightId) return
    const t = setTimeout(() => setHighlightId(null), 8000)
    return () => clearTimeout(t)
  }, [highlightId])

  function onAnswer(r: QueryResult) {
    if (!r.object) return
    setHighlightId(r.object.object_id)
    setOpenId(r.object.object_id)
  }

  async function startReposition() {
    try {
      await api.reposition('start')
      setRepositioning(true)
      refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not start repositioning')
    }
  }

  const closeReposition = useCallback(() => {
    setRepositioning(false)
    api.regions().then(setRegions).catch(() => undefined)
  }, [])

  const open = objects.find((o) => o.object_id === openId)
  const seenCount = objects.filter((o) => o.seen).length

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 pb-16 sm:px-6 lg:pt-10">
      <header className="enter mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">Keepsake</h1>
          <p className="mt-1 text-lg text-muted">Your room remembers, so you don&apos;t have to.</p>
        </div>
        <StatusPill health={health} offline={offline} />
      </header>

      {offline && (
        <p className="mb-5 rounded-2xl bg-amber-50 p-4 text-[15px] text-amber-ink">
          Can&apos;t reach Keepsake right now. The last memories loaded are shown below; start the backend to see updates.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <main className="min-w-0 space-y-6">
          <SearchPanel onResult={onAnswer} />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div role="tablist" aria-label="View" className="inline-flex rounded-full bg-stone-200/70 p-1">
              {([['list', 'List', LayoutGrid], ['map', 'Map', MapIcon]] as const).map(([key, label, Icon]) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={view === key}
                  onClick={() => setView(key)}
                  className={`flex min-h-11 items-center gap-2 rounded-full px-5 text-[15px] font-semibold transition-[background-color,color] duration-150 ${view === key ? 'bg-card text-ink shadow-card' : 'text-stone-600 hover:text-ink'}`}
                >
                  <Icon className="size-4" /> {label}
                </button>
              ))}
            </div>
            <span className="text-[15px] text-muted">{seenCount} of {objects.length} items remembered</span>
          </div>

          {view === 'list' ? (
            <ObjectList objects={objects} now={now} highlightId={highlightId} onOpen={setOpenId} />
          ) : (
            <RoomMap regions={regions} objects={objects} highlightId={highlightId} onOpen={setOpenId} />
          )}
        </main>

        <aside className="space-y-6">
          <CameraPanel health={health} onReposition={startReposition} />
          <ActivityFeed events={events} />
          <PrivacyPanel health={health} onChanged={refresh} />
        </aside>
      </div>

      {open && <ObjectDetail key={open.object_id} o={open} now={now} onClose={() => setOpenId(null)} />}
      {repositioning && health && health.mode !== 'MONITORING' && (
        <RepositionFlow health={health} regions={regions} onRegions={setRegions} onClose={closeReposition} />
      )}
    </div>
  )
}
