export const dynamic = 'force-dynamic'

import Link from 'next/link'
import TryToolPage from '@/components/TryToolPage'
import { getTenant } from '@/lib/get-tenant'

export default async function ProbeerPage() {
  const tenant = await getTenant()

  return (
    <>
      {/* Teruglink naar salespagina */}
      <div className="bg-dark border-b border-dark-border">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/" className="text-text-muted text-xs hover:text-white transition-colors">
            &larr; Terug naar Waybetter
          </Link>
          <span className="text-text-muted text-xs">Probeer de tool</span>
        </div>
      </div>

      <TryToolPage tenant={tenant} />
    </>
  )
}
