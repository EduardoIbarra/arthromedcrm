import prisma from '@/lib/prisma'
import { notFound } from 'next/navigation'
import LandingPageClient from './LandingPageClient'

interface PublicPageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ greeting?: string; clientId?: string; lang?: string }>
}

export default async function PublicLandingPage({ params, searchParams }: PublicPageProps) {
  const resolvedParams = await params
  const resolvedSearchParams = await searchParams
  const slug = resolvedParams.slug

  // 1. Fetch Landing Page
  const landingPage = await prisma.landing_pages.findUnique({
    where: { slug },
    include: {
      congresos: true
    }
  })

  if (!landingPage) {
    notFound()
  }

  // 2. Fetch associated specialties
  const specialties = landingPage.specialty_ids.length > 0
    ? await prisma.catalog_specialties.findMany({
        where: {
          id: { in: landingPage.specialty_ids }
        },
        orderBy: { name: 'asc' }
      })
    : []

  // 3. Fetch products belonging to any of these specialties
  const products = landingPage.specialty_ids.length > 0
    ? await prisma.productos.findMany({
        where: {
          specialty_ids: {
            hasSome: landingPage.specialty_ids
          },
          activo: true
        },
        orderBy: { nombre: 'asc' }
      })
    : []

  // Map Decimal values to numbers for serialization
  const serializedProducts = products.map((p: any) => ({
    id: p.id,
    nombre: p.nombre,
    precio_unitario: p.precio_unitario !== null ? Number(p.precio_unitario) : null,
    categoria: p.categoria,
    tipo: p.tipo,
    model: p.model,
    order_code: p.order_code,
    generic_description: p.generic_description,
    specialty_ids: p.specialty_ids,
    image_urls: p.image_urls
  }))

  // 4. Fetch associated catalogues
  const catalogues = landingPage.catalogo_ids.length > 0
    ? await prisma.catalogos.findMany({
        where: {
          id: { in: landingPage.catalogo_ids }
        },
        orderBy: { name: 'asc' }
      })
    : []

  // 5. Fetch congress contacts if tied to a congress
  const congressContacts = landingPage.congress_id
    ? await prisma.congress_contacts.findMany({
        where: {
          congress_id: landingPage.congress_id
        }
      })
    : []

  return (
    <LandingPageClient 
      landingPage={landingPage}
      specialties={specialties}
      products={serializedProducts}
      catalogues={catalogues}
      congressContacts={congressContacts}
      urlGreeting={resolvedSearchParams.greeting || ''}
      urlLang={resolvedSearchParams.lang || 'es'}
    />
  )
}
