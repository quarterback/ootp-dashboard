import './globals.css'

export const metadata = {
  title: 'OOTP Dashboard',
  description: 'Advanced roster analysis for OOTP',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
