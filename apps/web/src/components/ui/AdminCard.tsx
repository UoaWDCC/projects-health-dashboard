import { BORDER_DEFAULT, BORDER_HOVER } from '@/lib/admin/layout'

interface AdminCardProps {
  children: React.ReactNode
}

export default function AdminCard({ children }: AdminCardProps) {
  return (
    <div
      className="transition-all duration-300"
      style={{
        borderRadius: '24px',
        border: '3px solid transparent',
        background: BORDER_DEFAULT,
        padding: '36px 40px',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = BORDER_HOVER
        e.currentTarget.style.boxShadow =
          '0 12px 32px rgba(227,51,163,0.12), 0 4px 12px rgba(7,124,241,0.08)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = BORDER_DEFAULT
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      {children}
    </div>
  )
}
