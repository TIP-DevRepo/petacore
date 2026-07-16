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
  ClipboardList,
  ShoppingCart,
} from "lucide-react"

export interface PagePermissions {
  clients?: boolean
  catalog?: boolean
  vendors?: boolean
  quotes?: boolean
  settings?: boolean
  salesOrders?: boolean
  purchaseOrders?: boolean
}

// permissionKey: null means always visible (no gate). Otherwise must match
// a boolean field on the role's permissions.pages object.
const navItems: { label: string; href: string; icon: typeof LayoutDashboard; permissionKey: keyof PagePermissions | null }[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permissionKey: null },
  { label: "Clients", href: "/dashboard/clients", icon: Users, permissionKey: "clients" },
  { label: "Vendors", href: "/dashboard/vendors", icon: Truck, permissionKey: "vendors" },
  { label: "Catalog", href: "/dashboard/catalog", icon: Package, permissionKey: "catalog" },
  { label: "Quotes", href: "/dashboard/quotes", icon: FileText, permissionKey: "quotes" },
  { label: "Sales Orders", href: "/dashboard/sales-orders", icon: ClipboardList, permissionKey: "salesOrders" },
  { label: "Purchase Orders", href: "/dashboard/purchase-orders", icon: ShoppingCart, permissionKey: "purchaseOrders" },
  { label: "Settings", href: "/dashboard/settings", icon: Settings, permissionKey: "settings" },
]

export function Sidebar({ pagePermissions = {} }: { pagePermissions?: PagePermissions }) {
  const pathname = usePathname()

  const visibleItems = navItems.filter(
    (item) => item.permissionKey === null || pagePermissions[item.permissionKey] === true
  )

  return (
    <nav className="flex flex-col gap-1 p-4">
      <div className="mb-6 px-2">
        <span className="text-lg font-bold tracking-tight">PetaCore</span>
      </div>
      {visibleItems.map((item) => {
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