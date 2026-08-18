'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { ProjectHeaderData } from '@/lib/project/projects'

interface TeamHeaderProps {
  project: ProjectHeaderData
  isAdmin?: boolean
  activeProjectCount?: number
  onDeleteProject?: () => void
}

export default function TeamHeader({
  project,
  isAdmin = false,
  activeProjectCount,
  onDeleteProject,
}: TeamHeaderProps) {
  const memberCount = project._count.members
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleConfirmDelete = async () => {
    if (!onDeleteProject) return
    setIsDeleting(true)
    try {
      await onDeleteProject()
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  return (
    <>
      {/* MOBILE*/}
      <div className="lg:hidden bg-wdcc-blue-light rounded-2xl mx-5 sm:mx-10 mt-4 overflow-hidden">
        <div className="p-6 sm:p-8">
          {isAdmin && activeProjectCount !== undefined && (
            <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 mb-4 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
              {activeProjectCount} active project{activeProjectCount !== 1 ? 's' : ''}
            </div>
          )}

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

          {isAdmin && (
            <div className="flex gap-3 mt-6">
              <Link
                href={`/project/${project.slug}`}
                className="flex-1 text-center rounded-full bg-black text-white text-sm font-semibold px-5 py-2.5 whitespace-nowrap"
              >
                Edit details
              </Link>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="flex-1 rounded-full bg-white text-red-500 text-sm font-semibold px-5 py-2.5 border border-[#e5e7eb] whitespace-nowrap"
              >
                Delete project
              </button>
            </div>
          )}
        </div>
      </div>

      {/* DESKTOP */}
      <div className="hidden lg:block relative bg-wdcc-blue-light w-full">
        <div className="flex pt-[80px] pl-[80px] pr-[80px] pb-[80px]">
          <div className="flex-1 min-w-0">
            <div className="xl:ml-[176px] lg:ml-[145px] ml-[121px] backdrop-blur-xl rounded-full border-2 border-white font-mono px-3 sm:px-4 lg:px-5 py-1.5 sm:py-2 lg:py-2.5 flex gap-2 sm:gap-3 items-center w-fit bg-white/60 hover:brightness-95 cursor-default transition-all duration-500 ease-in-out mb-4">
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
                {memberCount} active member{memberCount !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="flex items-start">
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

              <div className="ml-[49px] flex-1 min-w-0">
                <h1 className="font-extrabold xl:text-[64px] lg:text-[48px] text-[36px] font-sans leading-tight">
                  {project.name}
                </h1>
                <p className="xl:text-[20px] lg:text-[16px] text-[14px] xl:mt-[20px] md:mt-[16px] font-mono text-wdcc-grey max-w-[70%]">
                  {project.description && <span>{project.description}</span>}
                </p>
              </div>
            </div>
          </div>

          {isAdmin && (
            <div className="flex flex-col gap-3 shrink-0 ml-8 mt-1">
              <Link
                href={`/project/${project.slug}`}
                className="text-center rounded-full bg-gradient-to-b from-[#252C48] to-[#161B30] text-white text-sm font-semibold px-10 py-4 hover:brightness-200 transition-colors"
              >
                Edit details
              </Link>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="rounded-full bg-white/50 text-red-700 text-sm font-bold px-10 py-4 border border-[#DAA5A5] hover:bg-red-50 transition-colors"
              >
                Delete project
              </button>
            </div>
          )}
        </div>
      </div>

      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-project-title"
          onClick={() => !isDeleting && setShowDeleteConfirm(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-project-title" className="text-lg font-bold font-sans">
              Delete &ldquo;{project.name}&rdquo;?
            </h2>
            <p className="mt-2 text-sm font-mono text-wdcc-grey leading-relaxed">
              This permanently deletes the project and everything linked to it - repositories,
              members, weekly stats, and Discord data. This can&apos;t be undone.
            </p>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="flex-1 rounded-full border border-[#e5e7eb] px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 rounded-full bg-red-600 text-white px-5 py-2.5 text-sm font-semibold hover:bg-red-700 disabled:opacity-50 whitespace-nowrap"
              >
                {isDeleting ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
