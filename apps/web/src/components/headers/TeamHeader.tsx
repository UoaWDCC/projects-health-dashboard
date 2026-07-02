import Image from 'next/image'
import type { ProjectHeaderData } from '@/lib/project/projects'

export default function TeamHeader({ project }: { project: ProjectHeaderData }) {
  const memberCount = project._count.members

  return (
    <>
      {/* MOBILE*/}
      <div className="lg:hidden bg-wdcc-blue-light rounded-2xl mx-5 sm:mx-10 mt-4 overflow-hidden">
        <div className="p-6 sm:p-8">
          <div className="flex flex-row items-center gap-5">
            <div className="w-[72px] h-[72px] bg-[#d9d9d9] overflow-hidden rounded-[20px] shrink-0">
              {project.imageUrl && (
                <Image
                  src={project.imageUrl}
                  alt={project.name}
                  width={72}
                  height={72}
                  className="w-full h-full object-cover"
                />
              )}
            </div>

            <div className="min-w-0">
              <h1 className="font-extrabold text-[28px] sm:text-[32px] font-sans leading-tight">
                {project.name}
              </h1>
              <p className="mt-0.5 text-[14px] font-mono text-wdcc-grey">
                {memberCount} Member{memberCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {project.description && (
            <p className="mt-4 text-[14px] font-mono text-wdcc-grey leading-relaxed">
              {project.description}
            </p>
          )}
        </div>
      </div>

      {/* DESKTOP */}
      <div className="hidden lg:block relative bg-wdcc-blue-light w-full">
        <div className="flex pt-[80px] pl-[80px] pb-[80px]">
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
          className="absolute right-[20px] md:right-[60px] xl:right-[110px] bottom-[-90px] w-[120px] md:w-[160px] xl:w-[190px] h-auto z-10 shrink-0"
        />
      </div>
    </>
  )
}
