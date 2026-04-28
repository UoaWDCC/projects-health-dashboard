import Image from 'next/image'
import Link from 'next/link'

interface HeaderProps {
  activeProjectCount: number
}

export const Header: React.FC<HeaderProps> = ({
  activeProjectCount,
}: HeaderProps): React.JSX.Element => {
  return (
    <div className="px-5 sm:px-10 lg:px-20 pt-12 sm:pt-16 lg:pt-24 pb-10 sm:pb-12 lg:pb-16 relative w-full max-w-[90rem] mx-auto">
      {/* Status pill */}
      {activeProjectCount > 0 && (
        <div className="backdrop-blur-xl rounded-full border border-white font-mono px-3 sm:px-4 lg:px-5 py-1.5 sm:py-2 lg:py-2.5 flex gap-2 sm:gap-3 items-center w-fit bg-white/60 hover:brightness-95 cursor-default transition-all duration-500 ease-in-out">
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
          <span className="text-wdcc-grey text-xs sm:text-sm lg:text-2xl font-medium whitespace-nowrap">
            {activeProjectCount} active project{activeProjectCount !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Main Headings*/}
      <div className="mt-6 sm:mt-8 lg:mt-11 flex items-end justify-between">
        <div className="flex flex-col justify-between">
          <div>
            <h1 className="text-wdcc-oshan uppercase font-extrabold tracking-tight !leading-none m-0 text-[clamp(2.625rem,8vw,6.3125rem)]">
              Projects Health Dashboard
            </h1>

            {/* Subheading */}
            <div className="mt-6 sm:mt-8 lg:mt-10 max-w-[54.1875rem]">
              <h3 className="text-wdcc-grey font-medium text-[clamp(1rem,2.5vw,1.75rem)] leading-relaxed m-0">
                Track commits, team vibes, and health scores across all WDCC projects — live and at
                a glance.
              </h3>
            </div>
          </div>

          {/* CTA */}
          <div className="pt-12 sm:pt-14 lg:pt-16">
            <Link
              href="/leaderboard"
              className="rounded-full px-7 sm:px-8 lg:px-8 py-3 sm:py-4 lg:py-4 bg-wdcc-oshan hover:bg-wdcc-orange transition-all duration-500 ease-in-out text-white font-bold text-base sm:text-lg lg:text-lg inline-block"
            >
              See leaderboard
            </Link>
          </div>
        </div>

        {/* Illustration */}
        <div className="hidden lg:flex items-end shrink-0">
          <Image
            src="/webster-header.png"
            alt="WDCC Webster mascot"
            width={320}
            height={320}
            className="object-contain hover:scale-110 transition-all duration-500 ease-in-out hover:drop-shadow-2xl hover:-rotate-12"
          />
        </div>
      </div>
    </div>
  )
}
