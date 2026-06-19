import GroupDetailPage from '@/frontend/pages/group-detail'

export default function Page({ params }: { params: { id: string } }) {
  return <GroupDetailPage params={params} />
}
