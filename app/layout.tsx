import type { Metadata } from 'next'
import { Inter, Zilla_Slab } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
// Serifada grossa dos títulos, próxima à tipografia do cardápio da Fredda
const display = Zilla_Slab({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-display' })

export const metadata: Metadata = {
  title: 'Fredda Pizzaria',
  description: 'Sistema de gestão para pizzaria de longa fermentação',
  icons: {
    icon: '/fredda_pizzaria.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${display.variable}`}>
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
