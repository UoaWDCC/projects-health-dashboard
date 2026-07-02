import { ArrowRight } from 'lucide-react'

/**
 * Mobile-only "View all members" button.
 */
export default function ViewAllMembersButton() {
  return (
    <button
      type="button"
      aria-label="View all members (coming soon)"
      className="lg:hidden w-full flex items-center gap-4 rounded-2xl bg-wdcc-oshan px-6 py-5 text-white cursor-default"
    >
      <div className="flex items-center -space-x-2 shrink-0">
        <span className="w-6 h-6 rounded-full border-2 border-wdcc-oshan bg-[#077CF1]" />
        <span className="w-6 h-6 rounded-full border-2 border-wdcc-oshan bg-[#E333A3]" />
        <span className="w-6 h-6 rounded-full border-2 border-wdcc-oshan bg-[#FFB05F]" />
      </div>
      <span className="font-sans text-base font-semibold">View all members</span>
      <ArrowRight className="ml-auto w-5 h-5 shrink-0" />
    </button>
  )
}
