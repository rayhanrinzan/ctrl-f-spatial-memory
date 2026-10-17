import type { Snapshot } from '../lib/api'
import { focusPosition } from '../lib/format'

/** A saved memory photo. `full` shows the whole frame with the object's box highlighted. */
export function SnapshotPhoto({ snapshot, alt, full = false, className = '' }: {
  snapshot: Snapshot
  alt: string
  full?: boolean
  className?: string
}) {
  const [x0, y0, x1, y1] = snapshot.bbox
  if (!full) {
    return (
      <img
        src={snapshot.image_url}
        alt={alt}
        loading="lazy"
        style={{ objectPosition: focusPosition(snapshot.bbox) }}
        className={`size-full object-cover outline-1 -outline-offset-1 outline-black/10 ${className}`}
      />
    )
  }
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <img src={snapshot.image_url} alt={alt} className="block h-auto w-full" />
      <div
        aria-hidden
        className="absolute rounded-lg ring-3 ring-clay-500 shadow-[0_0_0_9999px_oklch(0.2_0.02_50/0.28)]"
        style={{
          left: `${x0 * 100}%`, top: `${y0 * 100}%`,
          width: `${(x1 - x0) * 100}%`, height: `${(y1 - y0) * 100}%`,
        }}
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 outline-1 -outline-offset-1 outline-black/10" />
    </div>
  )
}
