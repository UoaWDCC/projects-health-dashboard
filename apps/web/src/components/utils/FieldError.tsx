export default function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="font-mono text-[11px] text-wdcc-kelvin mt-1">{message}</p>
}
