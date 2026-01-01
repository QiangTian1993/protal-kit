import { useEffect, useRef, useState } from 'react'
import { IconSearch, IconClose } from './Icons'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  autoFocus?: boolean
  onEscape?: () => void
}

export function SearchInput({
  value,
  onChange,
  placeholder = '搜索...',
  autoFocus = false,
  onEscape
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isFocused, setIsFocused] = useState(false)

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
    }
  }, [autoFocus])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFocused) {
        e.preventDefault()
        if (value) {
          onChange('')
        } else if (onEscape) {
          onEscape()
        }
        inputRef.current?.blur()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isFocused, value, onChange, onEscape])

  return (
    <div className={`searchInput ${isFocused ? 'isFocused' : ''}`}>
      <IconSearch className="searchInputIcon" width={18} height={18} />
      <input
        ref={inputRef}
        type="text"
        className="searchInputField"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      <button
        type="button"
        className={`searchInputClear ${value ? 'isVisible' : ''}`}
        onClick={() => {
          onChange('')
          inputRef.current?.focus()
        }}
        aria-label="清空搜索"
        tabIndex={value ? 0 : -1}
      >
        <IconClose width={14} height={14} />
      </button>
    </div>
  )
}
