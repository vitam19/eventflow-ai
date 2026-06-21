import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'EventFlow AI',
  description: 'AI операційний директор для івент-бізнесу',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk">
      <body>{children}</body>
    </html>
  )
}
