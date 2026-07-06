"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Users,
  Package,
  FileText,
  Settings,
  Truck,
} from "lucide-react"

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Clients", href: "/dashboard/clients", icon: Users },
  { label: "Vendors", href: "/dashboard/vendors", icon: Truck },
  { label: "Catalog", href: "/dashboard/catalog", icon: Package },
  { label: "Quotes", href: "/dashboard/quotes", icon: FileText },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-1 p-4">
      <div className="mb-6 px-2">
        <span className="text-lg font-bold tracking-tight">PetaCore</span>
      </div>
      {navItems.map((item) => {
        const isActive = item.href === "/dashboard/settings"
          ? pathname.startsWith("/dashboard/settings")
          : pathname === item.href
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}