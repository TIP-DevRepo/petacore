"use client"

import { useEffect, useState } from "react"
import { Alert, CloseButton } from "@heroui/react"

interface AppAlertProps {
  status?: "default" | "accent" | "success" | "warning" | "danger"
  title: string
  description?: string
  // If set, the alert disappears on its own after this many ms (good for
  // save confirmations). Leave unset for things that should stay until the
  // user dismisses them (like a feature announcement).
  autoDismissMs?: number
  onDismiss?: () => void
}

export function AppAlert({
  status = "default",
  title,
  description,
  autoDismissMs,
  onDismiss,
}: AppAlertProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (!autoDismissMs) return
    const timer = setTimeout(() => {
      setVisible(false)
      onDismiss?.()
    }, autoDismissMs)
    return () => clearTimeout(timer)
  }, [autoDismissMs, onDismiss])

  if (!visible) return null

  return (
    <Alert status={status} className="items-start">
      <Alert.Indicator />
      <Alert.Content className="flex-1">
        <Alert.Title>{title}</Alert.Title>
        {description && <Alert.Description>{description}</Alert.Description>}
      </Alert.Content>
      {!autoDismissMs && (
        <CloseButton
          onClick={() => {
            setVisible(false)
            onDismiss?.()
          }}
        />
      )}
    </Alert>
  )
}