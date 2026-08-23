'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  /** Optional supporting line under the title. */
  description?: React.ReactNode
  children: React.ReactNode
}

/**
 * Centred dialog with a dimmed backdrop.
 *
 * Closes on Escape and on backdrop click, locks background scroll while open,
 * and moves focus to the first focusable control so keyboard users land inside
 * the dialog rather than behind it.
 */
export default function Modal({ open, onClose, title, description, children }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  // Callers pass an inline arrow for onClose, so its identity changes on every
  // parent render. Reading it through a ref keeps the effect keyed on `open`
  // alone — otherwise it would tear down and re-run mid-interaction, yanking
  // focus back to the top of the dialog while the user is typing.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)

    // Prefer the first form field. The close (✕) button precedes the children
    // in DOM order, so a plain "first focusable" query would land there.
    const panel = panelRef.current
    const target =
      panel?.querySelector<HTMLElement>('input, select, textarea') ??
      panel?.querySelector<HTMLElement>('button')
    target?.focus()

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-wdcc-oshan/40 backdrop-blur-[2px] px-5"
      onMouseDown={(event) => {
        // Only a press that starts on the backdrop closes — a drag that ends
        // there after starting inside a text field should not.
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-[440px] rounded-3xl bg-white shadow-[0_24px_60px_rgba(31,32,49,0.25)] px-8 pt-7 pb-7"
      >
        <div className="flex items-start justify-between gap-4 mb-1">
          <h2 className="font-extrabold text-xl text-wdcc-oshan tracking-tight">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-wdcc-grey-light hover:text-wdcc-oshan transition-colors -mr-1 -mt-0.5"
          >
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        {description && (
          <p className="font-mono text-xs text-wdcc-grey leading-relaxed mb-5">{description}</p>
        )}

        <div className={description ? '' : 'mt-5'}>{children}</div>
      </div>
    </div>
  )
}
