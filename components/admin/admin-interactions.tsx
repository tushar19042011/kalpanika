"use client"

import { createPortal } from "react-dom"
import { Check, ChevronDown, X } from "lucide-react"
import { useEffect, useId, useRef, useState, type ComponentType, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react"

type MenuOption = {
  label: string
  onSelect: () => void
  icon?: ComponentType<{ className?: string }>
  destructive?: boolean
  selected?: boolean
  disabled?: boolean
  disabledReason?: string
}

export function AdminDropdown({
  label,
  options,
  trigger,
  triggerClassName = "",
  align = "end",
  disabled = false,
}: {
  label: string
  options: MenuOption[]
  trigger?: ReactNode
  triggerClassName?: string
  align?: "start" | "end"
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const optionsRef = useRef(options)
  optionsRef.current = options

  const updatePosition = () => {
    const bounds = triggerRef.current?.getBoundingClientRect()
    if (!bounds) return
    const width = 192
    const left = align === "end" ? Math.max(8, Math.min(bounds.right - width, window.innerWidth - width - 8)) : Math.max(8, Math.min(bounds.left, window.innerWidth - width - 8))
    const height = Math.min(options.length * 36 + 12, window.innerHeight - 24)
    const below = bounds.bottom + 6
    const top = below + height <= window.innerHeight - 8 ? below : Math.max(8, bounds.top - height - 6)
    setPosition({ top, left })
  }

  useEffect(() => {
    if (!open) return
    updatePosition()
    const enabledIndexes = () => optionsRef.current.flatMap((option, index) => option.disabled ? [] : [index])
    const focusFrame = window.requestAnimationFrame(() => optionRefs.current[enabledIndexes()[0]]?.focus())
    const onOutside = (event: PointerEvent) => {
      if (triggerRef.current?.contains(event.target as Node) || menuRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false)
        triggerRef.current?.focus()
      } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault()
        const enabled = enabledIndexes()
        if (!enabled.length) return
        const current = optionRefs.current.indexOf(document.activeElement as HTMLButtonElement)
        const currentEnabledIndex = enabled.indexOf(current)
        const direction = event.key === "ArrowDown" ? 1 : -1
        const nextEnabledIndex = currentEnabledIndex === -1
          ? 0
          : (currentEnabledIndex + direction + enabled.length) % enabled.length
        optionRefs.current[enabled[nextEnabledIndex]]?.focus()
      }
    }
    window.addEventListener("resize", updatePosition)
    window.addEventListener("scroll", updatePosition, true)
    document.addEventListener("pointerdown", onOutside)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      window.removeEventListener("resize", updatePosition)
      window.removeEventListener("scroll", updatePosition, true)
      document.removeEventListener("pointerdown", onOutside)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [align, open, options.length])

  return <>
    <button
      ref={triggerRef}
      type="button"
      disabled={disabled}
      aria-label={label}
      aria-haspopup="menu"
      aria-expanded={open}
      onClick={() => setOpen((current) => !current)}
      className={triggerClassName}
    >
      {trigger ?? <ChevronDown aria-hidden="true" className="size-3.5" />}
    </button>
    {open && typeof document !== "undefined" && createPortal(
      <div
        ref={menuRef}
        role="menu"
        aria-label={label}
        style={{ position: "fixed", top: position.top, left: position.left }}
        className="z-[100] w-48 rounded-lg border border-[#e8e6e0] bg-white p-1.5 shadow-lg shadow-black/10"
      >
        {options.map((option, index) => {
          const Icon = option.icon
          return <button
            key={option.label}
            ref={(element) => { optionRefs.current[index] = element }}
            disabled={option.disabled}
            title={option.disabledReason}
            type="button"
            role="menuitem"
            onClick={() => { if (option.disabled) return; option.onSelect(); setOpen(false); triggerRef.current?.focus() }}
            className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
              option.disabled ? "text-[#999]" : option.destructive ? "text-[#a34d4d] hover:bg-[#fbeaea]" : "text-[#555] hover:bg-[#f7f6f2] hover:text-[#191919]"
            }`}
          >
            {Icon && <Icon aria-hidden="true" className="size-4" />}
            <span className="flex-1">{option.label}</span>
            {option.selected && <Check aria-hidden="true" className="size-4 text-[#6f4e37]" />}
          </button>
        })}
      </div>,
      document.body,
    )}
  </>
}

export function AdminDialog({
  title,
  description,
  onClose,
  children,
  widthClassName = "max-w-xl",
}: {
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  widthClassName?: string
}) {
  const dialogRef = useRef<HTMLElement>(null)
  const titleId = useId()
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const firstFocusable = dialogRef.current?.querySelector<HTMLElement>("[autofocus]")
      ?? dialogRef.current?.querySelector<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]',
      )
    firstFocusable?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')
        if (dialogs[dialogs.length - 1] === dialogRef.current) onClose()
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      previousFocus?.focus()
    }
  }, [onClose])

  const trapFocus = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== "Tab") return
    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]',
    ) ?? [])
    if (focusable.length === 0) {
      event.preventDefault()
      return
    }
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return <div
    className="fixed inset-0 z-[90] flex items-center justify-center bg-black/35 p-4"
    onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}
  >
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      ref={dialogRef}
      onKeyDown={trapFocus}
      className={`max-h-[90vh] w-full ${widthClassName} overflow-y-auto rounded-xl border border-[#e8e6e0] bg-white shadow-xl`}
    >
      <header className="flex items-start justify-between gap-4 border-b border-[#eee] px-5 py-4">
        <div>
          <h2 id={titleId} className="font-semibold">{title}</h2>
          {description && <p className="mt-1 text-sm text-[#777]">{description}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Close dialog" className="rounded-md p-1 text-[#777] hover:bg-[#f5f3ef]">
          <X aria-hidden="true" className="size-5" />
        </button>
      </header>
      {children}
    </section>
  </div>
}
