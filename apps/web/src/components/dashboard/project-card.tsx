'use client'

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
    <div className="relative w-[300px] h-[265px] rounded-[31px] group overflow-visible font-sans">
      {/* Gradient background */}
      <div className="pointer-events-none absolute inset-0 group-hover:-inset-[4px] rounded-[31px] group-hover:rounded-[33px] transition-all duration-300 ease-out bg-[linear-gradient(to_bottom_left,_rgba(255,176,95,0.4)_22%,_rgba(227,51,163,0.4)_50%,_rgba(7,124,241,0.4)_100%)] group-hover:bg-[linear-gradient(to_top_right,_rgba(255,176,95,1)_22%,_rgba(227,51,163,1)_50%,_rgba(7,124,241,1)_100%)]" />

      <div
        className="
          absolute inset-[4px]
          transition-all duration-300 ease-out
          bg-white rounded-[27px]
        "
      />

      <div className="absolute inset-[8px] z-10 px-[19px] pt-[25px] pb-[18px] flex flex-col h-[calc(100%-16px)]">
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

        <h3 className="mt-[14px] text-[25.53px] font-extrabold leading-none">{name}</h3>

        <p className="mt-[10px] text-[19.7px] leading-tight text-[#9A9EB8] line-clamp-1 mono-ui">
          {description}
        </p>

        <div className="mt-auto pt-4 flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${statusStyle.dot}`} />
          <span className={`text-[19.7px] text-[#9A9EB8] mono-ui`}>{statusStyle.label}</span>
        </div>
      </div>
    </div>
  )
}

export default ProjectCard
