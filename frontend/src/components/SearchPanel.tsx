import { useEffect, useRef, useState } from 'react'
import { LoaderCircle, Mic, Search, Square, Volume2 } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import type { QueryResult } from '../lib/api'
import { listenOnce, speak, speechInputSupported, stopVoice, VoiceError } from '../lib/voice'

/** Conversation: IDLE → PROMPTING → LISTENING → LOOKING_UP → RESPONDING → IDLE */
type Phase = 'IDLE' | 'PROMPTING' | 'LISTENING' | 'LOOKING_UP' | 'RESPONDING'

const PHASE_LABEL: Record<Phase, string> = {
  IDLE: '',
  PROMPTING: 'Asking…',
  LISTENING: 'Listening… say the item, like “my water bottle”',
  LOOKING_UP: 'Checking my memory…',
  RESPONDING: 'Answering…',
}

export function SearchPanel({ onResult }: { onResult: (r: QueryResult) => void }) {
  const [phase, setPhase] = useState<Phase>('IDLE')
  const [heard, setHeard] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [text, setText] = useState('')
  const run = useRef(0) // increments to cancel an in-flight conversation

  useEffect(() => () => stopVoice(), [])

  async function lookUp(q: string, id: number, spoken: boolean) {
    setPhase('LOOKING_UP')
    let r: QueryResult
    try {
      r = await api.query(q)
    } catch (e) {
      if (id !== run.current) return
      const msg = e instanceof ApiError && e.status === 0
        ? "I can't reach Keepsake's memory right now. Check that the backend is running."
        : "Something went wrong looking that up."
      setError(msg)
      setPhase('IDLE')
      if (spoken) await speak(msg)
      return
    }
    if (id !== run.current) return
    setAnswer(r.answer)
    onResult(r)
    setPhase('RESPONDING')
    await speak(r.answer)
    if (id === run.current) setPhase('IDLE')
  }

  async function startVoice() {
    const id = ++run.current
    setError(null)
    setAnswer(null)
    setHeard('')
    if (!speechInputSupported) {
      setError("Voice isn't available in this browser. Type what you're looking for instead (Chrome, Edge and Safari support voice).")
      return
    }
    setPhase('PROMPTING')
    await speak('What are you looking for?') // wait for the prompt to finish before opening the mic
    if (id !== run.current) return
    setPhase('LISTENING')
    let said: string
    try {
      said = await listenOnce(setHeard)
    } catch (e) {
      if (id !== run.current) return
      const ve = e instanceof VoiceError ? e : new VoiceError('other', 'Voice input stopped unexpectedly.')
      if (ve.code === 'aborted') return
      const msg = ve.code === 'no-speech' ? "I didn't hear anything. Tap Voice to try again." : ve.message
      setError(msg)
      setPhase('IDLE')
      if (ve.code === 'no-speech') await speak("I didn't hear anything.")
      return
    }
    if (id !== run.current) return
    setHeard(said)
    await lookUp(said, id, true)
  }

  function stop() {
    run.current++
    stopVoice()
    setPhase('IDLE')
  }

  async function submitTyped(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    const id = ++run.current
    stopVoice()
    setError(null)
    setHeard('')
    await lookUp(text, id, false)
  }

  const busy = phase !== 'IDLE'
  const listening = phase === 'LISTENING'

  return (
    <section className="rounded-[28px] bg-card p-5 shadow-card sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <button
          onClick={busy ? stop : startVoice}
          aria-label={busy ? 'Stop voice assistant' : 'Ask Keepsake by voice'}
          className={[
            'press relative flex min-h-16 shrink-0 items-center justify-center gap-3 rounded-full px-7 text-lg font-semibold text-white',
            busy ? 'bg-ink hover:bg-stone-800' : 'bg-clay-600 shadow-lift hover:bg-clay-700',
          ].join(' ')}
        >
          {listening && <span className="pulse-ring absolute inset-0 rounded-full bg-clay-500/50" />}
          {busy ? <Square className="relative size-5 fill-current" /> : <Mic className="relative size-6" />}
          <span className="relative">{busy ? 'Stop' : 'Voice'}</span>
        </button>

        <form onSubmit={submitTyped} className="relative flex-1">
          <label htmlFor="ask" className="sr-only">Ask where something is</label>
          <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-stone-400" />
          <input
            id="ask"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Or type: where is my phone?"
            className="min-h-14 w-full rounded-full border border-line bg-paper pr-24 pl-12 text-base outline-none placeholder:text-stone-400 focus:border-clay-500 focus:ring-3 focus:ring-clay-500/20"
          />
          <button
            type="submit"
            className="press absolute top-1/2 right-2 min-h-10 -translate-y-1/2 rounded-full bg-stone-100 px-4 text-sm font-medium hover:bg-stone-200"
          >
            Find
          </button>
        </form>
      </div>

      {(busy || answer || error || heard) && (
        <div className="mt-4 space-y-2" aria-live="polite">
          {busy && (
            <p className="flex items-center gap-2 text-[15px] text-muted">
              {phase === 'LOOKING_UP' && <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />}
              {PHASE_LABEL[phase]}
            </p>
          )}
          {heard && <p className="text-[15px]"><span className="text-muted">You said: </span>“{heard}”</p>}
          {answer && phase !== 'LOOKING_UP' && (
            <p className="enter flex items-start gap-3 rounded-2xl bg-clay-50 p-4 font-serif text-xl leading-snug text-ink">
              <Volume2 className="mt-1 size-5 shrink-0 text-clay-600" />
              {answer}
            </p>
          )}
          {error && <p className="rounded-2xl bg-amber-50 p-3 text-[15px] text-amber-ink">{error}</p>}
        </div>
      )}
    </section>
  )
}
