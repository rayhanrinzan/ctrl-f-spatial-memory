// Browser speech helpers. Recognition is push-to-talk: call listen() from a button.
// A future wake-word listener can call the same listen() when it hears the trigger phrase.

/* eslint-disable @typescript-eslint/no-explicit-any */
const Recognition: any =
  typeof window !== 'undefined'
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : undefined

export const speechInputSupported = Boolean(Recognition)
export const speechOutputSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

export interface Listener {
  stop: () => void
}

export function listen(handlers: {
  onResult: (text: string) => void
  onInterim?: (text: string) => void
  onEnd: () => void
  onError: (message: string) => void
}): Listener | null {
  if (!Recognition) return null
  const rec = new Recognition()
  rec.lang = 'en-US'
  rec.interimResults = true
  rec.maxAlternatives = 1
  rec.onresult = (e: any) => {
    const result = e.results[e.results.length - 1]
    const text = result[0].transcript as string
    if (result.isFinal) handlers.onResult(text)
    else handlers.onInterim?.(text)
  }
  rec.onerror = (e: any) =>
    handlers.onError(
      e.error === 'not-allowed' ? 'Microphone access was blocked.' : `Voice input error: ${e.error}`,
    )
  rec.onend = handlers.onEnd
  rec.start()
  return { stop: () => rec.stop() }
}

export function speak(text: string) {
  if (!speechOutputSupported) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.rate = 1.02
  window.speechSynthesis.speak(u)
}
