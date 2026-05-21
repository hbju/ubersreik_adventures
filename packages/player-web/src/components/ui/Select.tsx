import { useState, useRef, useEffect, useId, type ReactNode } from 'react'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectGroup {
  label: string
  options: SelectOption[]
}

export interface SelectProps {
  options: (SelectOption | SelectGroup)[]
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  label?: string
  error?: string
  disabled?: boolean
  id?: string
}

function isGroup(item: SelectOption | SelectGroup): item is SelectGroup {
  return 'options' in item
}

export function Select({ options, value, onChange, placeholder = 'Select…', label, error, disabled, id: propId }: SelectProps) {
  const autoId = useId()
  const id = propId ?? autoId
  const errorId = `${id}-error`
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // All flat options for keyboard nav
  const flatOptions = options.flatMap((item) => (isGroup(item) ? item.options : [item]))
  const selectedOption = flatOptions.find((o) => o.value === value)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Keyboard handling
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setOpen((o) => !o)
    } else if (e.key === 'Escape') {
      setOpen(false)
    } else if (e.key === 'ArrowDown' && open) {
      e.preventDefault()
      const idx = flatOptions.findIndex((o) => o.value === value)
      const next = flatOptions.find((o, i) => i > idx && !o.disabled)
      if (next) onChange?.(next.value)
    } else if (e.key === 'ArrowUp' && open) {
      e.preventDefault()
      const idx = flatOptions.findIndex((o) => o.value === value)
      const prev = [...flatOptions].reverse().find((o, i) => flatOptions.length - 1 - i < idx && !o.disabled)
      if (prev) onChange?.(prev.value)
    }
  }

  const selectOption = (opt: SelectOption) => {
    if (opt.disabled) return
    onChange?.(opt.value)
    setOpen(false)
  }

  return (
    <div className="flex flex-col gap-1" ref={containerRef}>
      {label && (
        <label htmlFor={id} className="text-sm font-display text-secondary tracking-wide">
          {label}
        </label>
      )}
      <div className="relative">
        <button
          type="button"
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={`${id}-listbox`}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          disabled={disabled}
          onKeyDown={handleKeyDown}
          onClick={() => !disabled && setOpen((o) => !o)}
          className={`
            flex w-full items-center justify-between rounded-sm border bg-bg-dark px-3 py-2 text-left text-base min-h-[44px]
            transition-all duration-150
            focus:outline-none focus:ring-2 focus:ring-brass/50 focus:border-brass
            disabled:cursor-not-allowed disabled:opacity-50
            ${error ? 'border-blood' : 'border-dark hover:border-brass/50'}
            ${open ? 'border-brass ring-2 ring-brass/50' : ''}
          `}
        >
          <span className={selectedOption ? 'text-primary' : 'text-muted'}>
            {selectedOption?.label ?? placeholder}
          </span>
          <ChevronIcon open={open} />
        </button>

        {open && (
          <ul
            ref={listRef}
            id={`${id}-listbox`}
            role="listbox"
            className="absolute z-50 mt-1 w-full rounded-sm border border-brass bg-bg-elevated shadow-deep max-h-60 overflow-y-auto wfrp-scrollbar animate-modal-scale-in"
          >
            {options.map((item, i) =>
              isGroup(item) ? (
                <li key={i} role="group" aria-label={item.label}>
                  <span className="block px-3 pt-2 pb-1 text-xs font-display text-muted uppercase tracking-wider">
                    {item.label}
                  </span>
                  {item.options.map((opt) => (
                    <OptionItem key={opt.value} option={opt} selected={opt.value === value} onSelect={selectOption} />
                  ))}
                </li>
              ) : (
                <OptionItem key={item.value} option={item} selected={item.value === value} onSelect={selectOption} />
              )
            )}
          </ul>
        )}
      </div>
      {error && (
        <p id={errorId} className="text-xs text-blood-light mb-0" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

function OptionItem({ option, selected, onSelect }: { option: SelectOption; selected: boolean; onSelect: (o: SelectOption) => void }) {
  return (
    <li
      role="option"
      aria-selected={selected}
      aria-disabled={option.disabled}
      onClick={() => onSelect(option)}
      className={`
        cursor-pointer px-3 py-2 text-sm transition-colors
        ${selected ? 'bg-brass/15 text-accent' : 'text-primary hover:bg-brass/10'}
        ${option.disabled ? 'opacity-40 cursor-not-allowed' : ''}
      `}
    >
      {option.label}
    </li>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`text-muted transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}
