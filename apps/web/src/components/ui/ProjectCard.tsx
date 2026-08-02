import { forwardRef, memo } from 'react'
import Image from 'next/image'
import type { ProjectCardData } from '@/lib/project/projects'
import { clamp01 } from '@/lib/utils'

const statusStyles = {
  active: {
    label: 'Active',
    dot: 'bg-green-500',
  },
  archived: {
    label: 'Archived',
    dot: 'bg-yellow-400',
  },
}

interface ProjectCardProps {
  project: ProjectCardData
  viewMode?: 'tiles' | 'rows'
  litAmount?: number
}

function borderStyle(amount: number, maxInsetPx: number, baseRadius: string): React.CSSProperties {
  const clamped = clamp01(amount)
  const alpha = 0.4 + clamped * 0.6
  const insetPx = Math.round(clamped * maxInsetPx)
  return {
    background: `linear-gradient(to top right, rgba(255,176,95,${alpha}) 22%, rgba(227,51,163,${alpha}) 50%, rgba(7,124,241,${alpha}) 100%)`,
    inset: `-${insetPx}px`,
    borderRadius: `calc(${baseRadius} + ${insetPx}px)`,
  }
}

const ProjectCard = forwardRef<HTMLDivElement, ProjectCardProps>(function ProjectCard(
  { project, viewMode, litAmount = 0 },
  ref
) {
  const { name, description, isActive, imageUrl } = project
  const statusKey: keyof typeof statusStyles = isActive === true ? 'active' : 'archived'
  const statusStyle = statusStyles[statusKey]

  if (viewMode === 'rows') {
    return (
      <div ref={ref} className="relative w-full rounded-2xl overflow-visible font-sans">
        <div className="pointer-events-none absolute" style={borderStyle(litAmount, 2, '16px')} />
        <div className="absolute inset-[2px] bg-white rounded-[14px]" />

        <div className="relative z-10 flex flex-row items-center gap-3 p-2.5">
          <div className="w-14 h-14 rounded-[16px] bg-[#d9d9d9] overflow-hidden shrink-0">
            {imageUrl && (
              <Image
                src={imageUrl}
                alt={name}
                width={56}
                height={56}
                className="w-full h-full object-cover"
              />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="text-[clamp(0.85rem,4vw,1.05rem)] font-extrabold leading-tight truncate">
              {name}
            </h3>
            <p className="mt-0.5 text-[clamp(0.65rem,3vw,0.8rem)] leading-snug text-wdcc-grey-light font-mono truncate">
              {description}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 pl-1">
            <span
              className={`flex items-center gap-1.5 ${isActive ? 'rounded-full bg-[#E1F6E8] px-2.5 py-1' : ''}`}
            >
              <span className={`w-2 h-2 rounded-full ${statusStyle.dot} shrink-0`} />
              <span className="text-[clamp(0.65rem,3vw,0.8rem)] text-wdcc-grey-light font-mono whitespace-nowrap">
                {statusStyle.label}
              </span>
            </span>
          </div>
        </div>
      </div>
    )
  }

  if (viewMode === 'tiles') {
    return (
      <div
        ref={ref}
        className="relative w-full aspect-square rounded-2xl overflow-visible font-sans"
      >
        <div className="pointer-events-none absolute" style={borderStyle(litAmount, 2, '16px')} />
        <div className="absolute inset-[2px] bg-white rounded-[14px]" />

        <div className="absolute inset-[2px] z-10 flex flex-col p-3 overflow-hidden">
          <div className="w-[34%] aspect-square max-w-[52px] rounded-[16px] bg-[#d9d9d9] overflow-hidden shrink-0">
            {imageUrl && (
              <Image
                src={imageUrl}
                alt={name}
                width={52}
                height={52}
                className="w-full h-full object-cover"
              />
            )}
          </div>

          <h3 className="mt-2.5 shrink-0 text-[clamp(0.7rem,3.4vw,0.95rem)] font-extrabold leading-tight line-clamp-2">
            {name}
          </h3>

          <p className="mt-1 shrink-0 text-[clamp(0.6rem,2.6vw,0.75rem)] leading-snug text-wdcc-grey-light font-mono line-clamp-2">
            {description}
          </p>

          <div className="mt-auto shrink-0 flex items-center gap-1.5 pt-2">
            <span
              className={`flex items-center gap-1.5 min-w-0 ${isActive ? 'rounded-full bg-[#E1F6E8] px-2 py-1' : ''}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot} shrink-0`} />
              <span className="text-[clamp(0.6rem,2.8vw,0.75rem)] text-wdcc-grey-light font-mono truncate">
                {statusStyle.label}
              </span>
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    // 420px is also hardcoded into page.tsx's CARD_GROUP_INSET — keep both in sync.
    <div
      ref={ref}
      className="
        relative w-full mx-auto
        xl:max-w-[420px] xl:aspect-[420/270]
        max-w-[420px] sm:min-h-[270px]
        rounded-[clamp(18px,2.5vw,31px)]
        overflow-visible font-sans
      "
    >
      <div
        className="pointer-events-none absolute"
        style={borderStyle(litAmount, 4, 'clamp(18px,2.5vw,31px)')}
      />
      <div className="absolute inset-[3px] md:inset-[4px] bg-white rounded-[clamp(15px,2.2vw,28px)]" />

      <div
        className="
          absolute inset-[6px] md:inset-[8px] z-10
          flex flex-col h-[calc(100%-12px)] md:h-[calc(100%-16px)]
          px-3 sm:px-4 xl:px-[clamp(12px,2vw,19px)]
          pt-4 sm:pt-5 xl:pt-[clamp(16px,2.5vw,25px)]
          pb-3 sm:pb-4 xl:pb-[clamp(12px,2vw,18px)]
          rounded-[clamp(12px,2vw,25px)]
        "
      >
        <div className="flex flex-row items-center">
          <div className="w-[74px] h-[74px] rounded-[20px] bg-[#d9d9d9] overflow-hidden shrink-0">
            {imageUrl && (
              <Image
                src={imageUrl}
                alt={name}
                width={74}
                height={74}
                className="w-full h-full object-cover"
              />
            )}
          </div>

          <h3
            className="
            ml-8
            text-[16px] sm:text-[18px] xl:text-[clamp(18px,2.2vw,25.53px)]
            font-extrabold leading-tight
          "
          >
            {name}
          </h3>
        </div>
        <p
          className="
            mt-1 sm:mt-2 xl:mt-[25px]
            text-[13px] sm:text-[14px] xl:text-[clamp(14px,1.6vw,19.7px)]
            leading-snug text-wdcc-grey-light
            line-clamp-2
            font-mono
          "
        >
          {description}
        </p>

        <div className="mt-auto pt-3 sm:pt-4 xl:pt-[clamp(8px,2vw,16px)] flex items-center gap-2">
          <span
            className={`flex items-center gap-2 ${isActive ? 'rounded-full bg-[#E1F6E8] px-3 py-1.5' : ''}`}
          >
            <span
              className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${statusStyle.dot} shrink-0`}
            />
            <span className="text-[13px] sm:text-[14px] xl:text-[clamp(14px,1.6vw,19.7px)] text-wdcc-grey-light font-mono">
              {statusStyle.label}
            </span>
          </span>
        </div>
      </div>
    </div>
  )
})

export default memo(ProjectCard)
