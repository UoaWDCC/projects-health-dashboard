import type { GlobalWeeklySummaryData } from '@/lib/project/summary'
import { formatUpdated } from '@/lib/utils'

type Props = {
  summary: GlobalWeeklySummaryData | null
}

export default function GlobalWeeklySummary({ summary }: Props) {
  return (
    <section
      aria-labelledby="global-summary-heading"
      className="w-full rounded-[28px] border border-[#E3ECF8] bg-white px-7 py-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
    >
      <div className="flex flex-row items-start justify-between gap-4">
        <h2
          id="global-summary-heading"
          className="m-0 text-xl font-semibold tracking-tight text-[#14172B] !leading-tight"
        >
          Project Summary
        </h2>

        {summary && (
          <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-[#F1F5FB] px-3 py-1 font-mono text-[11px] text-[#4A5168]">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
            {formatUpdated(summary.generatedAt)}
          </span>
        )}
      </div>

      {summary ? (
        <p className="mt-4 max-w-4xl text-base leading-7 text-[#3A4054]">{summary.summaryText}</p>
      ) : (
        <p className="mt-4 text-base leading-7 text-[#3A4054]/70">
          No summary for the most recent week — Webster is still chewing through the data.
        </p>
      )}
    </section>
  )
}
