import { Navigation } from "@/components/navigation"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-background">
      <Navigation />
      <main className="flex-1 pt-16 pb-20 md:pt-0 md:pb-0 overflow-auto">
        {children}
      </main>
    </div>
  )
}
