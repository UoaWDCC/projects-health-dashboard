import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Merges Tailwind classes without conflicts, using clsx for conditional logic.
// All shadcn/ui components use this instead of plain string concatenation.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
