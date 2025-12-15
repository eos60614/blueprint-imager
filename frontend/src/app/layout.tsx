import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Navigation } from '@/components/Navigation'

export const metadata: Metadata = {
  title: 'Blueprint Imager - PDF to Tiles Converter',
  description: 'Convert PDF mechanical drawings to tiled PNG images for YOLO training. 600 DPI output with 1920x1920 tiles.',
  keywords: ['PDF', 'converter', 'tiling', 'YOLO', 'training', 'mechanical drawings', 'blueprint'],
  authors: [{ name: 'Blueprint Imager Team' }],
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#2563eb',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="py-6 sm:py-8">
          {children}
        </main>
      </body>
    </html>
  )
}
