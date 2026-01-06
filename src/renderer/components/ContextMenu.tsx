import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { hideActiveView, showActiveView } from '../lib/ipc/webapps'

export type ContextMenuPosition = { x: number; y: number }

export type ContextMenuItem =
  | {
      type?: 'item'
      id: string
      label: string
      icon?: React.ReactNode
      disabled?: boolean
      danger?: boolean
      onSelect: () => void | Promise<void>
    }
  | {
      type: 'separator'
      id: string
    }

interface ContextMenuProps {
  open: boolean
  position: ContextMenuPosition
  items: ContextMenuItem[]
  onClose: () => void
  ariaLabel?: string
  hideActiveViewOnOpen?: boolean
}

export function ContextMenu({
  open,
  position,
  items,
  onClose,
  ariaLabel = '上下文菜单',
  hideActiveViewOnOpen = false
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [adjustedPosition, setAdjustedPosition] = useState<ContextMenuPosition>(position)

  useEffect(() => {
    if (!hideActiveViewOnOpen) return
    if (!open) return

    void hideActiveView().catch(() => {})
    return () => {
      void showActiveView().catch(() => {})
    }
  }, [hideActiveViewOnOpen, open])

  useEffect(() => {
    if (!open) return
    setAdjustedPosition({ x: position.x, y: position.y })
  }, [open, position.x, position.y])

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  useLayoutEffect(() => {
    if (!open) return
    const el = menuRef.current
    if (!el) return

    const rect = el.getBoundingClientRect()
    const margin = 8
    const maxX = Math.max(margin, window.innerWidth - margin - rect.width)
    const maxY = Math.max(margin, window.innerHeight - margin - rect.height)
    const nextX = Math.min(Math.max(margin, adjustedPosition.x), maxX)
    const nextY = Math.min(Math.max(margin, adjustedPosition.y), maxY)

    if (nextX !== adjustedPosition.x || nextY !== adjustedPosition.y) {
      setAdjustedPosition({ x: nextX, y: nextY })
    }
  }, [open, adjustedPosition.x, adjustedPosition.y, items.length])

  if (!open) return null

  return (
    <div
      className="contextMenuBackdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        onClose()
      }}
    >
      <div
        className="contextMenu"
        ref={menuRef}
        role="menu"
        aria-label={ariaLabel}
        style={{ top: adjustedPosition.y, left: adjustedPosition.x }}
        onMouseDown={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        {items.map((item) => {
          if (item.type === 'separator') {
            return <div key={item.id} className="contextMenuSeparator" role="separator" />
          }

          return (
            <button
              key={item.id}
              type="button"
              className={`contextMenuItem ${item.danger ? 'isDanger' : ''}`}
              disabled={item.disabled}
              role="menuitem"
              onClick={() => {
                onClose()
                void Promise.resolve()
                  .then(item.onSelect)
                  .catch(() => {})
              }}
            >
              {item.icon && <span className="contextMenuItemIcon">{item.icon}</span>}
              <span className="contextMenuItemLabel">{item.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
