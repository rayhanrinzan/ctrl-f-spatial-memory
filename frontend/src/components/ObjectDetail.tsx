import { useEffect, useRef, useState } from 'react'
import { Camera, Clock, MapPin, X } from 'lucide-react'
import { api } from '../lib/api'
import type { Snapshot, TrackedObject } from '../lib/api'
import { EVENT_LABEL, fullTime, iconFor, placeName, timeAgo } from '../lib/format'
import { SnapshotPhoto } from './SnapshotPhoto'
import { StatusChip } from './ObjectList'

export function ObjectDetail({ o, now, onClose }: { o: TrackedObject; now: number; onClose: () => void }) {
  const [history, setHistory] = useState<Snapshot[]>([])
  const [pickedId, setPickedId] = useState<number | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const Icon = iconFor(o.icon)
  const latestId = o.snapshot?.id

  useEffect(() => {
    dialog.current?.showModal()
  }, [])

  useEffect(() => {
    if (!o.seen) return
    api.snapshots(o.object_id).then(setHistory).catch(() => setHistory([]))
  }, [o.object_id, o.seen, latestId])

  const shown = history.find((s) => s.id === pickedId) ?? o.snapshot
  const isLatest = !shown || shown.id === latestId

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && dialog.current?.close()}
      aria-labelledby="detail-title"
      className="enter m-auto max-h-[92dvh] w-[min(760px,calc(100vw-24px))] overflow-y-auto overscroll-contain rounded-[28px] bg-card p-0 text-ink shadow-lift backdrop:bg-stone-900/40 backdrop:backdrop-blur-sm"
    >
      <div className="p-4 sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-clay-50 text-clay-600">
              <Icon className="size-6" strokeWidth={2} />
            </span>
            <div>
              <h2 id="detail-title" className="font-serif text-2xl leading-tight">{o.name}</h2>
              <StatusChip o={o} />
            </div>
          </div>
          <button
            onClick={() => dialog.current?.close()}
            className="press flex size-11 items-center justify-center rounded-full bg-stone-100 text-stone-600 hover:bg-stone-200"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        {!o.seen ? (
          <div className="rounded-2xl bg-stone-100 p-8 text-center">
            <Icon className="mx-auto size-12 text-stone-400" strokeWidth={1.5} />
            <p className="mt-3 font-serif text-xl">Not yet seen</p>
            <p className="mt-1 text-[15px] text-muted">
              Keepsake hasn't spotted your {o.name.toLowerCase()} yet. Place it in view of the camera and it will be
              remembered with a photo.
            </p>
          </div>
        ) : (
          <>
            {shown ? (
              <SnapshotPhoto
                snapshot={shown}
                full
                alt={`Photo of your ${o.name.toLowerCase()} on the ${shown.region}`}
                className="rounded-2xl"
              />
            ) : (
              <div className="flex aspect-video items-center justify-center rounded-2xl bg-stone-100 text-center text-[15px] text-muted">
                <p className="max-w-sm p-6">
                  No photo was saved for this sighting (photo capture may have been paused).
                </p>
              </div>
            )}

            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="flex gap-3 rounded-2xl bg-paper p-4">
                <MapPin className="mt-0.5 size-5 shrink-0 text-clay-600" />
                <div>
                  <dt className="text-sm text-muted">{isLatest ? 'Last seen' : 'In this photo'}</dt>
                  <dd className="text-lg font-semibold">{placeName(isLatest ? o.region! : shown!.region)}</dd>
                </div>
              </div>
              <div className="flex gap-3 rounded-2xl bg-paper p-4">
                <Clock className="mt-0.5 size-5 shrink-0 text-clay-600" />
                <div>
                  <dt className="text-sm text-muted">{isLatest ? 'Time' : 'Photo taken'}</dt>
                  <dd className="text-lg font-semibold">{fullTime(isLatest ? o.last_seen! : shown!.timestamp)}</dd>
                  <dd className="text-sm text-muted">{timeAgo(isLatest ? o.last_seen! : shown!.timestamp, now)}</dd>
                </div>
              </div>
            </dl>

            {isLatest && <Note o={o} />}

            {history.length > 1 && (
              <section className="mt-6">
                <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-muted">
                  <Camera className="size-4" /> Earlier photos
                </h3>
                <ul className="flex gap-3 overflow-x-auto overscroll-x-contain pb-2">
                  {history.map((s) => (
                    <li key={s.id} className="shrink-0">
                      <button
                        onClick={() => setPickedId(s.id)}
                        aria-pressed={shown?.id === s.id}
                        className={`press block w-36 overflow-hidden rounded-xl text-left ${shown?.id === s.id ? 'ring-3 ring-clay-500' : 'ring-1 ring-line'}`}
                      >
                        <div className="aspect-[4/3]">
                          <SnapshotPhoto snapshot={s} alt={`${o.name} on the ${s.region}`} />
                        </div>
                        <div className="p-2 text-xs">
                          <div className="font-medium">{s.region} · {timeAgo(s.timestamp, now)}</div>
                          <div className="text-muted">{EVENT_LABEL[s.event_type]}</div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </dialog>
  )
}

function Note({ o }: { o: TrackedObject }) {
  let text: string | null = null
  if (o.awaiting_reconfirmation) {
    text = "This was before the camera was repositioned. Keepsake hasn't spotted it from the new view yet."
  } else if (o.lost_while_moving) {
    text = 'It looked like it was being moved when it left the camera’s view, so it may be somewhere else now.'
  } else if (!o.visible) {
    text = "It's out of view right now, so it may have moved since this photo."
  }
  return text ? <p className="mt-3 rounded-2xl bg-amber-50 p-4 text-[15px] text-amber-ink">{text}</p> : null
}
