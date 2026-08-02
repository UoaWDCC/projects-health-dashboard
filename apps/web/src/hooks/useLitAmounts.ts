'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { clamp01 } from '@/lib/utils'

const LIT_AMOUNT_PRECISION = 100

// Consolidates animation logic on the home page project card grid
export function useLitAmounts<K>(computeAmount: (rect: DOMRect, key: K) => number) {
  const [litAmounts, setLitAmounts] = useState<Map<K, number>>(new Map())
  const cardRefs = useRef<Map<K, HTMLDivElement>>(new Map())
  const lastLitAmountsRef = useRef<Map<K, number>>(new Map())
  const rafIdRef = useRef<number | null>(null)
  const computeAmountRef = useRef(computeAmount)
  computeAmountRef.current = computeAmount

  const scheduleRecompute = useCallback(() => {
    if (rafIdRef.current !== null) return

    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null

      const last = lastLitAmountsRef.current
      const next = new Map<K, number>()
      let changed = false

      cardRefs.current.forEach((el, key) => {
        const raw = computeAmountRef.current(el.getBoundingClientRect(), key)
        const litAmount = Math.round(clamp01(raw) * LIT_AMOUNT_PRECISION) / LIT_AMOUNT_PRECISION

        next.set(key, litAmount)
        if (last.get(key) !== litAmount) changed = true
      })

      if (changed || next.size !== last.size) {
        lastLitAmountsRef.current = next
        setLitAmounts(next)
      }
    })
  }, [])

  const refCallbacksRef = useRef<Map<K, (el: HTMLDivElement | null) => void>>(new Map())
  const setCardRef = useCallback((key: K) => {
    let callback = refCallbacksRef.current.get(key)
    if (!callback) {
      callback = (el) => {
        if (el) {
          cardRefs.current.set(key, el)
        } else {
          cardRefs.current.delete(key)
        }
      }
      refCallbacksRef.current.set(key, callback)
    }
    return callback
  }, [])

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current)
    }
  }, [])

  return { litAmounts, setCardRef, scheduleRecompute }
}
