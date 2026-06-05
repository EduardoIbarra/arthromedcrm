import TallerForm from '../_components/TallerForm'

export default async function EditTallerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <TallerForm tallerId={id} />
}
