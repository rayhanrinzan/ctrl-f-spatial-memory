import { useRef, useState } from 'react'
import { LoaderCircle, Mic, Search, Volume2 } from 'lucide-react'
import { api } from '../lib/api'
import type { QueryResult } from '../lib/api'
import { listen, speak, speechInputSupported } from '../lib/voice'
import type { Listener } from '../lib/voice'

export function SearchPanel({ onResult }: { onResult: (r: QueryResult) => void }) {
  const [text, setText] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [listening, setListening] = useState(false)
  const listener = useRef<Listener | null>(null)

  async function ask(q: string) {
    if (!q.trim()) return
    setBusy(true)
    setError(null)
    try {
      const r = await api.query(q)
      setAnswer(r.answer)
      speak(r.answer)
      onResult(r)
    } catch {
      setError("Couldn't reach the Ctrl+F server. Is the backend running?")
    } finally {
      setBusy(false)
    }
  }

  function toggleMic() {
    if (listening) {
      listener.current?.stop()
      return
    }
    setError(null)
    listener.current = listen({
      onInterim: setText,
      onResult: (t) => {
        setText(t)
        ask(t)
      },
      onEnd: () => setListening(false),
      onError: (m) => {
        setError(m)
        setListening(false)
      },
    })
    setListening(Boolean(listener.current))
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          ask(text)
        }}
        className="flex items-center gap-2"
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-500" />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={listening ? 'Listening…' : 'Ask where something is...'}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2.5 pr-3 pl-9 text-sm outline-none placeholder:text-zinc-500 focus:border-emerald-500"
          />
        </div>
        <button
          type="button"
          onClick={toggleMic}
          disabled={!speechInputSupported}
          title={speechInputSupported ? 'Press to talk' : 'Voice input is not supported in this browser'}
          className={[
            'relative flex size-10 items-center justify-center rounded-xl border transition',
            listening
              ? 'border-rose-400 bg-rose-500 text-white'
              : 'border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700',
            'disabled:cursor-not-allowed disabled:opacity-40',
          ].join(' ')}
          aria-label="Press to talk"
        >
          {listening && <span className="ping-ring absolute inset-0 rounded-xl bg-rose-500/50" />}
          <Mic className="relative size-4" />
        </button>
        <button
          type="submit"
          disabled={busy}
          className="flex h-10 items-center rounded-xl bg-emerald-500 px-4 text-sm font-medium text-emerald-950 hover:bg-emerald-400 disabled:opacity-60"
        >
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : 'Find'}
        </button>
      </form>
      {answer && (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-zinc-950/70 p-3 text-sm">
          <Volume2 className="mt-0.5 size-4 shrink-0 text-emerald-400" />
          <p>{answer}</p>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-rose-400">{error}</p>}
      {!speechInputSupported && (
        <p className="mt-2 text-xs text-zinc-500">Voice input isn't available in this browser — type instead. Try Chrome for push-to-talk.</p>
      )}
    </section>
  )
}
