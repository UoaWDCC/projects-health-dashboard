import { LiveCommit } from '@repo/db'
import Link from 'next/link'

export default function MarqueeLiveCommitRow({
  commit,
  projectSlug,
}: {
  commit: LiveCommit
  projectSlug: string
}) {
  const { message, commitUrl, authorName, authorUsername } = commit

  return (
    <div className="flex items-center gap-3 whitespace-nowrap font-mono text-sm px-3 shrink-0">
      <Link
        href={`${commitUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[#5C6370] hover:underline"
      >
        {message}
      </Link>

      <span className="p-[2px] rounded-full bg-[#5C6370] shrink-0" />

      {authorUsername ? (
        <Link
          href={`https://github.com/${authorUsername}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#0066FF] hover:underline"
        >
          {authorName}
        </Link>
      ) : (
        <Link href={`/project/${projectSlug}`} className="text-[#0066FF] hover:underline">
          {authorName}
        </Link>
      )}

      <span className="p-[3px] rounded-full bg-[#5C6370] shrink-0 ml-2" />
    </div>
  )
}
