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
        gap: 10,
        width: '100%',
        padding: '8px 12px',
        border: 'none',
        borderRadius: 6,
        background: isActive ? 'var(--surface-active)' : 'transparent',
        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
        fontSize: 13,
        fontWeight: isActive ? 600 : 400,
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
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 20,
          height: 20,
          flexShrink: 0
        }}
      >
        {icon}
      </span>
      <span>{label}</span>
    </button>
  )
}
