import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Sidebar from '@/components/Sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-[#f7f5ef]">
      <Sidebar />
      <main className="flex-1 overflow-auto min-w-0">
        <div className="p-4 md:p-8">{children}</div>
      </main>
    </div>
  )
}
