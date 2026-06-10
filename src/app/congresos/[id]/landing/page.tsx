import prisma from '@/lib/prisma'
import type { Metadata } from 'next'
import CongressLandingClient from './landing-client'

type Props = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params

  try {
    const congress = await prisma.congresos.findUnique({
      where: { id }
    })

    if (!congress) {
      return {
        title: 'Congreso no encontrado | Arthromed ERP'
      }
    }

    const title = `${congress.name} | Arthromed`
    const description = congress.description || 'Congreso Médico Exclusivo Arthromed'
    const imageUrl = congress.flyer && (congress.flyer.startsWith('http://') || congress.flyer.startsWith('https://'))
      ? congress.flyer
      : 'https://arthromed.mx/wp-content/uploads/2024/01/logoOrigPag.png'

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        images: [
          {
            url: imageUrl,
            alt: congress.name,
          }
        ],
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [imageUrl],
      }
    }
  } catch (error) {
    console.error('Error generating metadata:', error)
    return {
      title: 'Congreso | Arthromed ERP'
    }
  }
}

export default async function Page({ params }: Props) {
  const { id } = await params

  const congressData = await prisma.congresos.findUnique({
    where: { id },
    include: {
      congress_workshops: {
        include: {
          congress_workshop_enrollments: {
            select: { client_id: true }
          }
        }
      },
      congress_contacts: true,
      congress_catalogos: {
        include: {
          catalogos: true
        }
      },
      congreso_itinerarios: {
        orderBy: [
          { date: 'asc' },
          { time: 'asc' }
        ]
      },
      congreso_viajeros: {
        orderBy: { name: 'asc' }
      },
      congreso_gastos_estimados: {
        include: {
          catalog_spending_categories: true
        }
      }
    }
  })

  const initialCongress = congressData ? JSON.parse(JSON.stringify(congressData)) : null

  return <CongressLandingClient initialCongress={initialCongress} />
}
