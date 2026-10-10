import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Merges Tailwind classes without conflicts, using clsx for conditional logic.
// All shadcn/ui components use this instead of plain string concatenation.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

export function formatRelativeTime(timestamp: Date): string {
  const now = new Date()
  const diff = now.getTime() - timestamp.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (seconds === 0) {
    return 'Just now'
  }

  if (seconds < 60) {
    return `${seconds}s ago`
  }

  if (minutes < 60) {
    return `${minutes}m ago`
  }

  if (hours < 24) {
    return `${hours}h ago`
  }

  return `${days}d ago`
}

const NZ_TZ = 'Pacific/Auckland'

export function formatUpdated(date: Date): string {
  const day = new Intl.DateTimeFormat('en-NZ', {
    day: 'numeric',
    month: 'long',
    timeZone: NZ_TZ,
  }).format(date)

  const time = new Intl.DateTimeFormat('en-NZ', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: NZ_TZ,
  })
    .format(date)
    .replace(/\s/g, '')
    .toLowerCase()

  return `Updated ${day} ${time}`
}
