'use client'

import { useSyncExternalStore } from 'react'
import { getLatestLiveCommits, getProjectSlugs } from '@/actions/live-commits'
import { createClient } from '@/lib/supabase/client'
import { LiveCommit } from '@repo/db'

type LiveCommitsState = {
  commits: LiveCommit[]
  projectSlugs: Record<string, string>
  error: string | null
}

let state: LiveCommitsState = { commits: [], projectSlugs: {}, error: null }
const listeners = new Set<() => void>()
let subscriberCount = 0
let stopSubscription: (() => void) | null = null

function setState(partial: Partial<LiveCommitsState>) {
  state = { ...state, ...partial }
  listeners.forEach((listener) => listener())
}

function startSubscription() {
  getProjectSlugs()
    .then((projectSlugs) => setState({ projectSlugs }))
    .catch((err) => console.error('Failed to fetch project slugs:', err))

  getLatestLiveCommits()
    .then((commits) => setState({ commits, error: null }))
    .catch((err) => {
      console.error('Failed to fetch live commits:', err)
      setState({ error: 'Failed to load live commits. Please try again later.' })
    })

  const supabase = createClient()
  const channel = supabase
    .channel('live-commits-channel')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'LiveCommit' },
      async () => {
        try {
          const latest = await getLatestLiveCommits()
          setState({ commits: latest, error: null })
        } catch (err) {
          console.error('Failed to fetch latest live commits:', err)
        }
      }
    )
    .subscribe()

  return () => supabase.removeChannel(channel)
}

function subscribe(listener: () => void) {
  listeners.add(listener)

  if (subscriberCount === 0) {
    stopSubscription = startSubscription()
  }
  subscriberCount++

  return () => {
    listeners.delete(listener)
    subscriberCount--
    if (subscriberCount === 0) {
      stopSubscription?.()
      stopSubscription = null
    }
  }
}

function getSnapshot() {
  return state
}

function getServerSnapshot() {
  return state
}

export function useLiveCommits() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
