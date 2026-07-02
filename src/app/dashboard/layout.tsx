import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { Sidebar } from "@/components/layout/sidebar"
import { Topbar } from "@/components/layout/topbar"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar — permanent on desktop, hidden on mobile */}
      <aside className="hidden w-64 border-r md:block">
        <Sidebar />
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar userName={session.user.name ?? "User"} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}