import Link from 'next/link'

export default function NewProjectButton({ className = '' }: { className?: string }) {
  return (
    <Link href="/projects/new" className={className}>
      <button className="flex items-center gap-2 bg-wdcc-oshan text-white font-mono text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-wdcc-oshan/80 transition-colors duration-150">
        <span className="text-base leading-none">+</span>
        New project
      </button>
    </Link>
  )
}
