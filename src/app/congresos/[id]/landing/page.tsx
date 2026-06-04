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
      workshops: {
        include: {
          enrollments: {
            select: { client_id: true }
          }
        }
      },
      contacts: true,
      congress_catalogos: {
        include: {
          catalog: true
        }
      },
      itinerary_items: {
        orderBy: [
          { date: 'asc' },
          { time: 'asc' }
        ]
      },
      travelers: {
        orderBy: { name: 'asc' }
      },
      gastos_estimados: {
        include: {
          category: true
        }
      }
    }
  })

  const initialCongress = congressData ? JSON.parse(JSON.stringify(congressData)) : null

  return <CongressLandingClient initialCongress={initialCongress} />
}
