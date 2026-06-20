import LastUpdatedTime from './LastUpdatedTime'

interface LeaderboardHeaderProps {
  lastUpdated: Date
}

const LeaderboardHeader: React.FC<LeaderboardHeaderProps> = ({
  lastUpdated,
}: LeaderboardHeaderProps): React.JSX.Element => {
  return (
    <div
      className="w-full bg-wdcc-mint flex flex-col justify-center items-start gap-y-3 sm:gap-y-4 lg:gap-y-5 pt-16 sm:pt-20 lg:pt-24 pb-8 sm:pb-10 px-5 sm:px-10 lg:px-20"
      style={{ boxShadow: 'inset 0 0 5px rgba(0, 0, 0, 0.2)' }}
    >
      <h1 className="text-wdcc-oshan uppercase font-extrabold tracking-tight !leading-none m-0 text-[clamp(1.75rem,5vw,4rem)]">
        Weekly Leaderboard
      </h1>

      <div className="backdrop-blur-xl rounded-full border-2 border-white font-mono px-3 sm:px-4 lg:px-5 py-1.5 sm:py-2 lg:py-2.5 flex gap-2 sm:gap-3 items-center w-fit bg-white/60 hover:brightness-95 cursor-default transition-all duration-500 ease-in-out">
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="shrink-0 w-2 h-2 sm:w-2.5 sm:h-2.5 lg:w-3 lg:h-3"
        >
          <rect width="12" height="12" rx="5.90908" fill="#16A34A" />
        </svg>
        <span className="text-wdcc-grey text-xs sm:text-sm lg:text-xl font-medium whitespace-nowrap">
          Last updated on <LastUpdatedTime isoDate={lastUpdated.toISOString()} />
        </span>
      </div>
    </div>
  )
}

export default LeaderboardHeader
