"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronDown, Building2, UserCog } from "lucide-react"
import { cn } from "@/lib/utils"

const settingsCategories = [
  {
    label: "Company Settings",
    items: [
      { label: "Company Info & Branding", href: "/dashboard/settings/company", icon: Building2 },
    ],
  },
  {
    label: "Users",
    items: [
      { label: "Manage Users & Roles", href: "/dashboard/settings/users", icon: UserCog },
    ],
  },
]

export default function SettingsIndexPage() {
  const [openCategory, setOpenCategory] = useState<string | null>(null)

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <div className="space-y-2">
        {settingsCategories.map((category) => {
          const isOpen = openCategory === category.label
          return (
            <div key={category.label} className="rounded-md border">
              <button
                onClick={() => setOpenCategory(isOpen ? null : category.label)}
                className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium"
              >
                {category.label}
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    isOpen && "rotate-180"
                  )}
                />
              </button>

              {isOpen && (
                <div className="border-t px-4 py-2 flex flex-col gap-1">
                  {category.items.map((item) => {
                    const ItemIcon = item.icon
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                      >
                        <ItemIcon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}