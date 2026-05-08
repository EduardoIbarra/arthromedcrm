import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Verificación de Distribuidores | Arthromed',
  description: 'Portal de verificación oficial para distribuidores autorizados de Arthromed. Consulte la validez de nuestros socios comerciales.',
  keywords: ['Arthromed', 'distribuidores autorizados', 'verificación', 'equipo médico', 'socios comerciales'],
  openGraph: {
    title: 'Verificación de Distribuidores | Arthromed',
    description: 'Portal oficial para consultar distribuidores autorizados de equipo médico Arthromed.',
    images: [
      {
        url: 'https://arthromed.mx/wp-content/uploads/2024/01/logoOrigPag.png',
        width: 1200,
        height: 630,
        alt: 'Arthromed Logo',
      },
    ],
  },
}

export default function DistributorsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
