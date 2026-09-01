'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { GitHubRepository, DiscordChannel } from '@repo/db'

interface ConnectedSourcesProps {
  repositories: GitHubRepository[]
  channels: DiscordChannel[]
  onSaveRepository: (
    repositoryId: string,
    data: { owner: string; name: string }
  ) => Promise<void> | void
  onSaveChannel: (channelId: string, data: { externalId: string }) => Promise<void> | void
}

function SourceRow({
  variant,
  label,
  value,
  onSave,
}: {
  variant: 'github' | 'discord'
  label: string
  value: string
  onSave: (newValue: string) => Promise<void> | void
}) {
  const router = useRouter()

  const [displayValue, setDisplayValue] = useState(value)
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setDisplayValue(value)
  }, [value])

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)
    try {
      await onSave(draft)
      setDisplayValue(draft)
      setIsEditing(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSaving(false)
    }
  }

  const isDiscord = variant === 'discord'

  return (
    <div>
      <p className="text-xs font-mono tracking-wide text-gray-400 mb-2">{label}</p>

      <div
        className={`flex items-center gap-2 rounded-xl border-2 px-4 py-3 ${
          isDiscord ? 'bg-indigo-50/70 border-indigo-100' : 'bg-white border-[#e5e7eb]'
        }`}
      >
        <span
          className={`w-4 h-4 shrink-0 ${isDiscord ? 'rounded-md bg-wdcc-blue' : 'rounded-full bg-black'}`}
        />

        {isEditing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="flex-1 min-w-0 text-sm font-mono text-wdcc-blue bg-transparent outline-none border-b border-wdcc-blue/40"
          />
        ) : (
          <span className="flex-1 min-w-0 truncate text-sm font-mono text-wdcc-blue">
            {displayValue}
          </span>
        )}

        {isEditing ? (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="text-xs font-mono rounded-md bg-wdcc-blue text-white px-3 py-1.5 disabled:opacity-50"
            >
              {isSaving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(displayValue)
                setIsEditing(false)
              }}
              className="text-xs font-mono rounded-md border-2 border-[#e5e7eb] bg-white text-wdcc-blue px-3 py-1.5"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(displayValue)
              setIsEditing(true)
              setError(null)
            }}
            className="text-xs font-mono rounded-lg px-3 py-1.5 shrink-0 bg-white text-wdcc-blue border-2 border-wdcc-blue-light hover:bg-gray-50"
          >
            edit
          </button>
        )}
      </div>

      {error && <p className="text-xs font-mono text-red-500 mt-1">{error}</p>}
    </div>
  )
}

export default function ConnectedSources({
  repositories,
  channels,
  onSaveRepository,
  onSaveChannel,
}: ConnectedSourcesProps) {
  return (
    <div className="rounded-2xl border-2 border-wdcc-blue-light/30 bg-[#fafbfc] px-8 py-6">
      <p className="text-base font-mono tracking-widest text-wdcc-grey mb-5">CONNECTED SOURCES</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex flex-col gap-4">
          {repositories.length === 0 && (
            <p className="text-sm font-mono text-wdcc-grey">No repository connected.</p>
          )}
          {repositories.map((repo) => (
            <SourceRow
              key={repo.id}
              variant="github"
              label="GITHUB REPOSITORY"
              value={`github.com/${repo.owner}/${repo.name}`}
              onSave={async (newValue) => {
                const cleaned = newValue
                  .trim()
                  .replace(/^(https?:\/\/)?(www\.)?github\.com\//i, '')
                  .replace(/\/+$/, '')
                const [owner, name] = cleaned.split('/')
                if (!owner || !name) {
                  throw new Error('Please enter a valid GitHub URL')
                }
                await onSaveRepository(repo.id, { owner, name })
              }}
            />
          ))}
        </div>

        <div className="flex flex-col gap-4">
          {channels.length === 0 && (
            <p className="text-sm font-mono text-wdcc-grey">No Discord channel connected.</p>
          )}
          {channels.map((channel) => (
            <SourceRow
              key={channel.id}
              variant="discord"
              label={`DISCORD CHANNEL SNOWFLAKE${channels.length > 1 ? ` — ${channel.name}` : ''}`}
              value={channel.externalId}
              onSave={(newValue) => onSaveChannel(channel.id, { externalId: newValue })}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
