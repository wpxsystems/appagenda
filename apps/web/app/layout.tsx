import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Racket App — Admin',
  description: 'Administração do App de Esportes de Raquete',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
