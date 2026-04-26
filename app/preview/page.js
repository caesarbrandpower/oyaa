export const dynamic = 'force-dynamic'

import Link from 'next/link'

const CTA_HREF = process.env.NEXT_PUBLIC_CTA_HREF || 'mailto:hello@newfound.agency'

export const metadata = {
  title: 'Waybetter Preview',
  robots: { index: false },
}

export default function PreviewPage() {
  return (
    <div className="min-h-screen bg-dark flex items-center justify-center">
      <p className="text-text-muted text-sm">Preview — wordt opgebouwd</p>
    </div>
  )
}
