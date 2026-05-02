import Image from 'next/image'
import type { ProjectHeaderData } from '@/lib/project/projects'

export default function TeamHeader({ project }: { project: ProjectHeaderData }) {
  return (
    <div className="relative bg-wdcc-blue-light w-full">
      <div className="flex pt-[57px] pl-[80px] pb-[51px]">
        <div className="xl:w-[127px] xl:h-[127px] lg:w-[96px] lg:h-[96px] w-[72px] h-[72px] bg-[#d9d9d9] overflow-hidden rounded-[20px] shrink-0">
          {project.imageUrl && (
            <Image
              src={project.imageUrl}
              alt={project.name}
              width={127}
              height={127}
              className="w-full h-full object-cover"
            />
          )}
        </div>
        <div className="ml-[49px] flex-1">
          <h1 className="font-extrabold xl:text-[64px] lg:text-[48px] text-[36px] font-sans leading-tight">
            {project.name}
          </h1>
          <p className="xl:text-[20px] lg:text-[16px] text-[14px] xl:mt-[20px] md:mt-[16px] font-mono text-wdcc-grey max-w-[70%]">
            {project.description && <span>{project.description} • </span>}
            <span>{project._count.members} Members</span>
          </p>
        </div>
      </div>
      <Image
        src="/webster-team-header.svg"
        width={190}
        height={249}
        alt="Team Header Image"
        className="absolute right-[20px] md:right-[60px] xl:right-[110px] bottom-[-65px] w-[120px] md:w-[160px] xl:w-[190px] h-auto z-10 shrink-0"
      />
    </div>
  )
}
