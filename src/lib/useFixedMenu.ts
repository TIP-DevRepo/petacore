import { useState, useLayoutEffect, useEffect, useRef, type RefObject } from "react"

export interface MenuAnchor {
  top: number
  bottom: number
  right: number
}

// Computes a fixed-position style for a dropdown menu, flipping upward if
// there's not enough room below the anchor. Fixed (not absolute) so the
// menu renders outside any scrolling/overflow-clipped container.
export function useFixedMenuPosition(open: boolean, anchor: MenuAnchor | null) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    if (!open || !anchor || !menuRef.current) {
      setPos(null)
      return
    }
    const menuHeight = menuRef.current.offsetHeight
    const menuWidth = menuRef.current.offsetWidth
    const spaceBelow = window.innerHeight - anchor.bottom
    const spaceAbove = anchor.top
    // Default to opening downward, right against the trigger; only flip up
    // if there's not enough room below AND genuinely more room above
    const openUpward = spaceBelow < menuHeight && spaceAbove > spaceBelow
    const top = openUpward ? Math.max(8, anchor.top - menuHeight - 4) : anchor.bottom + 4
    const left = Math.max(8, Math.min(anchor.right - menuWidth, window.innerWidth - menuWidth - 8))
    setPos({ top, left })
  }, [open, anchor])

  const style: React.CSSProperties = {
    position: "fixed",
    top: pos?.top ?? 0,
    left: pos?.left ?? 0,
    visibility: pos ? "visible" : "hidden",
  }

  return { menuRef, style }
}

// Closes the menu the instant the page scrolls, so a fixed-position menu
// never has the chance to visually drift away from the button that opened
// it. `capture: true` catches scroll events on any scrollable ancestor
// (like the table wrapper), not just the window itself.
export function useCloseOnScroll(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return
    function handleScroll() {
      onClose()
    }
    window.addEventListener("scroll", handleScroll, { capture: true, passive: true })
    return () => window.removeEventListener("scroll", handleScroll, { capture: true })
  }, [open, onClose])
}

// Closes the menu when clicking anywhere outside the given ref(s) — pass
// every element that should NOT count as "outside" (the menu itself, and
// usually the trigger button so clicking it again doesn't immediately
// reopen the menu via this listener).
export function useCloseOnOutsideClick(
  open: boolean,
  refs: RefObject<HTMLElement | null>[],
  onClose: () => void
) {
  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      const isInside = refs.some((ref) => ref.current?.contains(target))
      if (!isInside) onClose()
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open, onClose, refs])
}