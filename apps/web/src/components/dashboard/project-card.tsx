import React from 'react'
import Image from 'next/image'

export type ProjectCardData = {
  id?: string
  name: string
  description?: string | null
  isActive?: boolean | null
  imageUrl?: string | null
}

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

export const ProjectCard: React.FC<{ project: ProjectCardData }> = ({ project }) => {
  const { name, description, isActive, imageUrl } = project
  const statusKey: keyof typeof statusStyles = isActive === true ? 'active' : 'archived'
  const statusStyle = statusStyles[statusKey]

  return (
    <div className="relative w-full max-w-[300px] aspect-[300/265] rounded-[clamp(20px,3vw,31px)] group overflow-visible font-sans">
      {/* Gradient background */}
      <div
        className="pointer-events-none absolute inset-0 group-hover:-inset-[3px] md:group-hover:-inset-[4px] rounded-[inherit] transition-all duration-300 ease-out 
        bg-[linear-gradient(to_bottom_left,_rgba(255,176,95,0.4)_22%,_rgba(227,51,163,0.4)_50%,_rgba(7,124,241,0.4)_100%)] 
        group-hover:bg-[linear-gradient(to_top_right,_rgba(255,176,95,1)_22%,_rgba(227,51,163,1)_50%,_rgba(7,124,241,1)_100%)]"
      />
      <div className="absolute inset-[3px] md:inset-[4px] transition-all duration-300 ease-out bg-white rounded-[inherit]" />

      <div className="absolute inset-[6px] md:inset-[8px] z-10 px-[clamp(12px,2vw,19px)] pt-[clamp(16px,2.5vw,25px)] pb-[clamp(12px,2vw,18px)] flex flex-col h-[calc(100%-12px)] md:h-[calc(100%-16px)]">
        <div className="w-[clamp(56px,6vw,74px)] h-[clamp(56px,6vw,74px)] rounded-[clamp(14px,2vw,20px)] bg-[#d9d9d9] overflow-hidden shrink-0">
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
        <h3 className="mt-[clamp(10px,2vw,14px)] text-[clamp(18px,2.2vw,25.5px)] font-extrabold leading-none">
          {name}
        </h3>
        <p className="mt-[clamp(6px,1.5vw,10px)] text-[clamp(14px,1.8vw,19.7px)] leading-tight text-[#9A9EB8] line-clamp-1 font-mono">
          {description}
        </p>
        <div className="mt-auto pt-[clamp(8px,2vw,16px)] flex items-center gap-2">
          <span
            className={`w-[clamp(8px,1vw,10px)] h-[clamp(8px,1vw,10px)] rounded-full ${statusStyle.dot}`}
          />
          <span className="text-[clamp(14px,1.8vw,19.7px)] text-[#9A9EB8] font-mono">
            {statusStyle.label}
          </span>
        </div>
      </div>
    </div>
  )
}

export default ProjectCard
