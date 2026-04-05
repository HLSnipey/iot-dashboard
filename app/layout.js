import './globals.css'

export const metadata = {
  title: 'IoT Dashboard — ENETCOM PFA',
  description: 'Réseau IoT géré par ESP32 via I2C',
}

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body className="bg-gray-950 text-white min-h-screen">
        {children}
      </body>
    </html>
  )
}