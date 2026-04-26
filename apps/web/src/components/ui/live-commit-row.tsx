import { DM_Mono, Plus_Jakarta_Sans } from 'next/font/google'

const dmMono400 = DM_Mono({ subsets: ['latin'], weight: '400' })
const dmMono500 = DM_Mono({ subsets: ['latin'], weight: '500' })
const plusJakartaSans = Plus_Jakarta_Sans({ subsets: ['latin'] })

interface LiveCommitRowProps {
  message: string
  author: string
  projectName: string
  timestamp: Date
}

export default function LiveCommitRow({
  message,
  author,
  projectName,
  timestamp,
}: LiveCommitRowProps) {
  return (
    <div className="flex flex-row justify-between gap-4 border-t-2 border-[#1F20311A] bg-[#FFFFFF80] px-8 py-3">
      <div className="flex-1 min-w-0">
        <p
          className={`${dmMono400.className} text-[clamp(0.625rem,2.5vw,1.1rem)] text-[#1F2031] truncate`}
        >
          {message}
        </p>
        <div className="flex flex-row gap-3 min-w-0 mt-1">
          <p
            className={`${plusJakartaSans.className} text-[#5A5E7A] text-[clamp(0.625rem,2.5vw,1.1rem)] font-semibold place-self-center whitespace-nowrap shrink-0`}
          >
            {author}
          </p>
          <p
            className={`${dmMono500.className} text-[#077CF1] text-[clamp(0.5rem,2vw,1rem)] bg-[#E8E8E2] rounded-lg px-3 h-fit place-self-center truncate`}
          >
            {projectName}
          </p>
        </div>
      </div>
      <p
        className={`${dmMono400.className} text-[#9A9EB8] text-[clamp(0.5rem,2vw,1rem)] text-right place-self-center whitespace-nowrap shrink-0`}
      >
        {processDateTime(timestamp)}
      </p>
    </div>
  )
}

function processDateTime(timestamp: Date) {
  const now = new Date()
  const diff = now.getTime() - timestamp.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

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
