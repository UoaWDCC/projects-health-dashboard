import MemberAvatar from './MemberAvatar'
import type { TeamMemberStats } from '@/lib/project/weekly-stats'

const STATS = [
  {
    key: 'linesCommitted',
    label: 'Lines committed',
    shortLabel: 'Lines',
    tick: 'bg-leaderboard-loc-fill',
    mobileValue: 'text-leaderboard-loc-fill',
  },
  {
    key: 'commits',
    label: 'Commits',
    shortLabel: 'Commits',
    tick: 'bg-leaderboard-commits-fill',
    mobileValue: 'text-leaderboard-commits-fill',
  },
  {
    key: 'pullRequests',
    label: 'Pull requests',
    shortLabel: 'PRs',
    tick: 'bg-leaderboard-prs-fill',
    mobileValue: 'text-leaderboard-prs-fill',
  },
] as const

export default function MemberCard({ member }: { member: TeamMemberStats }) {
  return (
    <div className="h-full rounded-2xl lg:rounded-3xl p-px bg-[linear-gradient(160deg,#E333A366_0%,#077CF14D_50%,#FFB05F80_100%)]">
      <div className="h-full rounded-[15px] lg:rounded-[23px] bg-white overflow-hidden flex flex-col">
        {/* Avatar — banner background on desktop only, per Figma */}
        <div className="flex justify-center items-center pt-5 lg:pt-0 lg:h-[180px] xl:h-[210px] lg:bg-[linear-gradient(180deg,#F2F5FC_0%,#DCE3F2_100%)]">
          <MemberAvatar
            name={member.name}
            imageUrl={member.imageUrl}
            size={112}
            className="w-14 h-14 lg:w-24 lg:h-24 xl:w-28 xl:h-28"
          />
        </div>

        <div className="flex flex-col px-4 pb-4 pt-3 lg:px-6 lg:pb-6 lg:pt-5">
          <p className="font-mono text-base lg:text-xl text-wdcc-oshan text-center lg:text-left truncate">
            {member.name}
          </p>
          <p className="mt-0.5 font-mono text-xs lg:text-sm text-wdcc-grey-light text-center lg:text-left truncate">
            {member.username ? `@${member.username}` : ' '}
          </p>

          <div className="mt-3 lg:mt-4 divide-y divide-[#ECEEF6]">
            {STATS.map((stat) => (
              <div key={stat.key} className="flex items-center gap-2 py-2 lg:py-2.5">
                <span className={`hidden lg:block w-1 h-3.5 rounded-full shrink-0 ${stat.tick}`} />
                <span className="font-mono text-xs lg:text-sm text-wdcc-grey-light whitespace-nowrap">
                  <span className="lg:hidden">{stat.shortLabel}</span>
                  <span className="hidden lg:inline">{stat.label}</span>
                </span>
                <span
                  className={`ml-auto font-mono text-sm lg:text-lg ${stat.mobileValue} lg:text-wdcc-oshan`}
                >
                  {member[stat.key].toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
