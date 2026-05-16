export default function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 bg-wdcc-kelvin/10 border border-wdcc-kelvin/20 rounded-xl px-4 py-3 font-mono text-xs text-wdcc-kelvin">
      ✗ &nbsp;{message}
    </div>
  )
}
