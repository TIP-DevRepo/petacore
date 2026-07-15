"use client"

import type { ReactNode } from "react"

interface ModalProps {
  children: ReactNode
  maxWidth?: "sm" | "md" | "lg"
  /** Adds max-h-[90vh] overflow-y-auto for modals with long, scrollable content */
  scrollable?: boolean
}

const MAX_WIDTH_CLASSES: Record<NonNullable<ModalProps["maxWidth"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
}

// Shared modal backdrop + centered white box. Deliberately does NOT close
// on backdrop click — none of the modals using this had that behavior
// before, so this preserves exact existing behavior (every modal has its
// own explicit Cancel/Close button).
export function Modal({ children, maxWidth = "md", scrollable = false }: ModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className={`bg-white dark:bg-zinc-900 rounded-md p-6 w-full ${MAX_WIDTH_CLASSES[maxWidth]} space-y-4 ${
          scrollable ? "max-h-[90vh] overflow-y-auto" : ""
        }`}
      >
        {children}
      </div>
    </div>
  )
}