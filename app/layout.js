import './globals.css'

export const metadata = {
  title: 'AI Coding Assistant',
  description: 'Polished UI for AI coding help',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}