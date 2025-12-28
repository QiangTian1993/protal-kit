import React, { useEffect, useRef } from 'react'
import { IconClose } from './Icons'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEsc)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  const sizeClass = size === 'sm' ? 'modalSm' : size === 'lg' ? 'modalLg' : 'modalMd'

  return (
    <div
      className="modalBackdrop"
      ref={backdropRef}
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose()
      }}
    >
      <div className={`modalContent ${sizeClass}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modalHeader">
          <h2 id="modal-title" className="modalTitle">
            {title}
          </h2>
          <button className="modalCloseBtn" onClick={onClose} aria-label="关闭">
            <IconClose width={18} height={18} />
          </button>
        </div>
        <div className="modalBody">{children}</div>
      </div>
    </div>
  )
}

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  danger = false
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="confirmMessage">{message}</p>
      <div className="modalActions">
        <button className="btn" onClick={onClose}>
          {cancelText}
        </button>
        <button className={`btn ${danger ? 'btnDanger' : 'btnPrimary'}`} onClick={onConfirm}>
          {confirmText}
        </button>
      </div>
    </Modal>
  )
}
