import { useState } from 'react'
import { ShieldCheck, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import type { Health } from '../lib/api'

export function PrivacyPanel({ health, onChanged }: { health: Health | null; onChanged: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const capture = health?.capture_enabled ?? true

  async function toggle() {
    setError(null)
    await api.setCapture(!capture).catch((e) => setError(e.message))
    onChanged()
  }

  async function clearAll() {
    if (!confirm('Forget every remembered location and delete all saved photos? This can’t be undone.')) return
    setError(null)
    await api.clear().catch((e) => setError(e.message))
    onChanged()
  }

  return (
    <section className="rounded-3xl bg-card p-5 shadow-card">
      <h2 className="mb-2 flex items-center gap-2 font-serif text-lg">
        <ShieldCheck className="size-5 text-sage-600" /> Privacy
      </h2>
      <p className="text-[15px] leading-relaxed text-muted">
        Camera footage is processed on this computer. Keepsake saves selected object-memory photos, not a continuous
        video recording, and never uploads them.
      </p>
      <label className="mt-4 flex min-h-11 cursor-pointer items-center justify-between gap-3">
        <span className="text-[15px] font-medium">Save memory photos</span>
        <button
          role="switch"
          aria-checked={capture}
          onClick={toggle}
          disabled={!health}
          className={`relative h-7 w-12 rounded-full transition-[background-color] duration-150 ${capture ? 'bg-sage-600' : 'bg-stone-300'}`}
        >
          <span className={`absolute top-1 left-1 size-5 rounded-full bg-white shadow-card transition-[translate] duration-150 motion-reduce:transition-none ${capture ? 'translate-x-5' : ''}`} />
        </button>
      </label>
      {!capture && <p className="text-sm text-amber-ink">Photo capture is paused. Locations still update.</p>}
      <button
        onClick={clearAll}
        className="press mt-3 flex min-h-11 items-center gap-2 rounded-full bg-stone-100 px-4 text-[15px] font-medium hover:bg-red-50 hover:text-red-700"
      >
        <Trash2 className="size-4" /> Clear all memories and photos
      </button>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </section>
  )
}
