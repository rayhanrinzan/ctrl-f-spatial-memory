import { Backpack, BookOpen, Coffee, Laptop, Milk, Mouse, Package, Scissors, Smartphone, Tv } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const ICONS: Record<string, LucideIcon> = {
  bottle: Milk,
  cup: Coffee,
  'cell phone': Smartphone,
  book: BookOpen,
  backpack: Backpack,
  remote: Tv,
  scissors: Scissors,
  mouse: Mouse,
  laptop: Laptop,
}

export const iconFor = (category: string): LucideIcon => ICONS[category] ?? Package

export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} hr ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export const clockTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
