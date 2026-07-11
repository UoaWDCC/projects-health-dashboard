import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

/**
 * Mobile-only "View all members" link to the project's team members page.
 */
export default function ViewAllMembersButton({ slug }: { slug: string }) {
  return (
    <Link
      href={`/project/${slug}/members`}
      className="lg:hidden w-full flex items-center gap-4 rounded-2xl bg-wdcc-oshan px-6 py-5 text-white"
    >
      <div className="flex items-center -space-x-2 shrink-0">
        <span className="w-6 h-6 rounded-full border-2 border-wdcc-oshan bg-[#077CF1]" />
        <span className="w-6 h-6 rounded-full border-2 border-wdcc-oshan bg-[#E333A3]" />
        <span className="w-6 h-6 rounded-full border-2 border-wdcc-oshan bg-[#FFB05F]" />
      </div>
      <span className="font-sans text-base font-semibold">View all members</span>
      <ArrowRight className="ml-auto w-5 h-5 shrink-0" />
    </Link>
  )
}
