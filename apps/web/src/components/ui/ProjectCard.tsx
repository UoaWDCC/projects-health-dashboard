import Image from 'next/image'
import type { ProjectCardData } from '@/lib/project/projects'

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

const ProjectCard: React.FC<{ project: ProjectCardData }> = ({ project }) => {
  const { name, description, isActive, imageUrl } = project
  const statusKey: keyof typeof statusStyles = isActive === true ? 'active' : 'archived'
  const statusStyle = statusStyles[statusKey]

  return (
    <div
      className="
        relative w-full 
        xl:max-w-[420px] xl:aspect-[420/270]
        max-w-[420px] sm:min-h-[270px]
        rounded-[clamp(18px,2.5vw,31px)]
        group overflow-visible font-sans
      "
    >
      {/* Gradient background */}
      <div
        className="
          pointer-events-none absolute inset-0
          group-hover:-inset-[3px] md:group-hover:-inset-[4px]
          rounded-[clamp(18px,2.5vw,31px)] transition-all duration-700 ease-in-out
          bg-[linear-gradient(to_bottom_left,_rgba(255,176,95,0.4)_22%,_rgba(227,51,163,0.4)_50%,_rgba(7,124,241,0.4)_100%)]
          group-hover:bg-[linear-gradient(to_top_right,_rgba(255,176,95,1)_22%,_rgba(227,51,163,1)_50%,_rgba(7,124,241,1)_100%)]
        "
      />
      <div className="absolute inset-[3px] md:inset-[4px] transition-all duration-700 ease-in-out bg-white rounded-[clamp(15px,2.2vw,28px)]" />

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
          <div className="w-[52px] h-[52px] sm:w-[60px] sm:h-[60px] xl:w-[74px] xl:h-[74px] rounded-[14px] xl:rounded-[20px] bg-[#d9d9d9] overflow-hidden shrink-0">
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
            line-clamp-2 xl:line-clamp-1
            font-mono
          "
        >
          {description}
        </p>

        <div className="mt-auto pt-3 sm:pt-4 xl:pt-[clamp(8px,2vw,16px)] flex items-center gap-2">
          <span className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${statusStyle.dot}`} />
          <span className="text-[13px] sm:text-[14px] xl:text-[clamp(14px,1.6vw,19.7px)] text-wdcc-grey-light font-mono">
            {statusStyle.label}
          </span>
        </div>
      </div>
    </div>
  )
}

export default ProjectCard
