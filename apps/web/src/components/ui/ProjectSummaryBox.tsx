import { clamp01, cn } from '@/lib/utils'
import { sentimentBand, type SentimentBand } from '@/lib/project/summary'

interface ProjectSummaryProps {
  summaryText: string | null
  sentimentScore: number | null
}

const BAND_STYLES: Record<SentimentBand, { ground: string; bar: string; text: string }> = {
  'on-track': {
    ground: 'bg-sentiment-on-track-ground',
    bar: 'bg-sentiment-on-track-bar',
    text: 'text-sentiment-on-track-text',
  },
  watch: {
    ground: 'bg-sentiment-watch-ground',
    bar: 'bg-sentiment-watch-bar',
    text: 'text-sentiment-watch-text',
  },
  'off-track': {
    ground: 'bg-sentiment-off-track-ground',
    bar: 'bg-sentiment-off-track-bar',
    text: 'text-sentiment-off-track-text',
  },
}

function SentimentScoreBox({ score }: { score: number }) {
  const band = BAND_STYLES[sentimentBand(score)]

  return (
    <div
      className={cn(
        'rounded-2xl p-5 lg:p-6 w-full lg:w-[340px] xl:w-[400px] shrink-0 flex flex-col',
        band.ground
      )}
    >
      <p className={cn('font-mono text-xs tracking-[0.15em] uppercase', band.text)}>
        Sentiment Score
      </p>

      <p className={cn('font-extrabold text-5xl lg:text-6xl mt-3 lg:mt-4', band.text)}>
        {score.toFixed(1)}
      </p>

      <div
        className="h-2 rounded-full bg-white mt-6 overflow-hidden"
        role="meter"
        aria-label="Sentiment score"
        aria-valuenow={score}
        aria-valuemin={-1}
        aria-valuemax={1}
      >
        <div
          className={cn('h-full rounded-full', band.bar)}
          style={{ width: `${clamp01((score + 1) / 2) * 100}%` }}
        />
      </div>
    </div>
  )
}

/**
 * Admin & Exec only: LLM-written weekly summary for a project, with its sentiment score.
 */
export default function ProjectSummaryBox({ summaryText, sentimentScore }: ProjectSummaryProps) {
  return (
    <section className="w-full bg-white border border-gray-200 rounded-3xl p-6 lg:p-8 flex flex-col lg:flex-row gap-6 lg:gap-10">
      <div className="flex-1 min-w-0">
        <h2 className="text-xl lg:text-2xl font-extrabold">Project Summary</h2>

        {summaryText ? (
          <p className="mt-4 text-sm lg:text-base leading-relaxed text-wdcc-oshan">{summaryText}</p>
        ) : (
          <p className="mt-4 text-sm lg:text-base leading-relaxed text-wdcc-grey">
            No summary for this week — Webster is still chewing through the data.
          </p>
        )}
      </div>

      {sentimentScore !== null && <SentimentScoreBox score={sentimentScore} />}
    </section>
  )
}
