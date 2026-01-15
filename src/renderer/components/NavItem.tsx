import type { ReactNode } from 'react'

interface NavItemProps {
  icon: ReactNode
  label: string
  isActive: boolean
  onClick: () => void
}

export function NavItem({ icon, label, isActive, onClick }: NavItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        padding: '10px 12px',
        border: 'none',
        borderRadius: 8,
        background: isActive ? 'var(--surface-soft)' : 'transparent',
        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
        fontSize: 14,
        fontWeight: isActive ? 500 : 400,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        textAlign: 'left'
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'var(--surface-hover)'
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'transparent'
        }
      }}
    >
      <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>
      <span>{label}</span>
    </button>
  )
}

