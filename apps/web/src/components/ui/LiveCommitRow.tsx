import { LiveCommit } from '@repo/db'
import Link from 'next/link'
import { formatRelativeTime } from '@/lib/utils'

export default function LiveCommitRow({
  commit,
  projectSlug,
}: {
  commit: LiveCommit
  projectSlug: string
}) {
  const { message, commitUrl, repoName, authorName, committedAt, authorUsername } = commit
  return (
    <div className="flex flex-row justify-between gap-4 border-t-2 border-wdcc-oshan/10 px-5 lg:px-8 py-3">
      <div className="flex-1 min-w-0">
        <Link
          href={`${commitUrl}`}
          target="_blank"
          className={`block font-mono font-normal text-[clamp(0.625rem,2.5vw,1.1rem)] text-wdcc-oshan hover:text-wdcc-grey truncate`}
        >
          {message}
        </Link>
        <div className="flex flex-row gap-3 min-w-0 mt-1">
          {authorUsername && (
            <Link
              href={`https://github.com/${authorUsername}`}
              target="_blank"
              className={`font-sans text-wdcc-grey text-[clamp(0.625rem,2.5vw,1.1rem)] font-semibold place-self-center whitespace-nowrap shrink-0 hover:underline`}
            >
              {authorName}
            </Link>
          )}
          {!authorUsername && (
            <Link
              href={`/project/${projectSlug}`}
              className={`font-sans text-wdcc-grey text-[clamp(0.625rem,2.5vw,1.1rem)] font-semibold place-self-center whitespace-nowrap shrink-0 hover:underline`}
            >
              {authorName}
            </Link>
          )}
          <Link
            href={`/project/${projectSlug}`}
            className={`font-mono font-medium text-wdcc-blue text-[clamp(0.5rem,2vw,1rem)] bg-olive-200 hover:bg-wdcc-amber hover:text-white transition-colors duration-200 rounded-lg px-3 h-fit place-self-center truncate`}
          >
            {repoName}
          </Link>
        </div>
      </div>
      <p
        className={`font-mono font-normal text-wdcc-grey-light text-[clamp(0.5rem,2vw,1rem)] text-right place-self-center whitespace-nowrap shrink-0`}
      >
        {formatRelativeTime(committedAt)}
      </p>
    </div>
  )
}
