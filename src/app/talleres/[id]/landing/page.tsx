import prisma from '@/lib/prisma'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import WorkshopLandingClient from './WorkshopLandingClient'

type Props = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params

  try {
    const workshop = await prisma.congress_workshops.findUnique({
      where: { id }
    })

    if (!workshop) {
      return {
        title: 'Taller no encontrado | Arthromed ERP'
      }
    }

    const title = `${workshop.name} | Taller Arthromed`
    const description = workshop.description || 'Taller Médico de Alta Especialidad Arthromed'
    const imageUrl = workshop.flyer && (workshop.flyer.startsWith('http://') || workshop.flyer.startsWith('https://'))
      ? workshop.flyer
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
            alt: workshop.name,
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
      title: 'Taller | Arthromed ERP'
    }
  }
}

export default async function Page({ params }: Props) {
  const { id } = await params

  const workshopData = await prisma.congress_workshops.findUnique({
    where: { id },
    include: {
      congresos: {
        select: { id: true, name: true, location: true }
      },
      congress_workshop_doctors: {
        include: {
          doctors: {
            select: { id: true, name: true, specialty_ids: true, avatar_url: true }
          }
        }
      },
      _count: {
        select: { congress_workshop_enrollments: true }
      }
    }
  })

  if (!workshopData) {
    notFound()
  }

  const initialWorkshop = JSON.parse(JSON.stringify(workshopData))

  return <WorkshopLandingClient initialWorkshop={initialWorkshop} />
}
