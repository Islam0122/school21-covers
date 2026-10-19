import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Eye } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { ErrorState, LoadingState } from '@/components/ui/states'
import { SiteView } from '@/features/builder/site-view'
import { builderApi } from '@/services/api'

export default function DraftPreviewPage() {
  const { projectId = '', pageSlug } = useParams()
  const id = Number(projectId)
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['preview', id], queryFn: () => builderApi.preview(id) })
  if (isLoading) return <LoadingState className="h-screen" />
  if (error || !data) return <ErrorState className="m-8" error={error} onRetry={() => refetch()} />
  const banner = (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-3 bg-slate-900 px-4 py-2 text-xs text-white">
      <span className="flex items-center gap-2">
        <Eye className="size-3.5" /> Draft preview of <strong>{data.project.name}</strong> — only visible to project members. Shows saved changes.
      </span>
      <Link to={`/app/builder/${id}`} className="flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 hover:bg-white/20">
        <ArrowLeft className="size-3" /> Back to editor
      </Link>
    </div>
  )
  return <SiteView site={data} pageSlug={pageSlug} basePath={`/preview/${id}`} banner={banner} />
}
