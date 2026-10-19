import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'
import { LoadingState } from '@/components/ui/states'
import { SiteView } from '@/features/builder/site-view'
import { builderApi } from '@/services/api'
import { ApiError } from '@/services/http'

export default function PublishedSitePage() {
  const { slug = '', pageSlug } = useParams()
  const { data, isLoading, error } = useQuery({ queryKey: ['public-site', slug], queryFn: () => builderApi.publicSite(slug), staleTime: 60_000 })
  if (isLoading) return <LoadingState className="h-screen" />
  if (error || !data)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-2xl font-bold">{error instanceof ApiError && error.status === 404 ? 'Site not found' : 'Unable to load site'}</h1>
        <p className="mt-2 text-muted">This site is not published or the address is incorrect.</p>
      </div>
    )
  return (
    <>
      <SiteView site={data} pageSlug={pageSlug} basePath={`/sites/${slug}`} />
      <a href="/" className="fixed bottom-3 right-3 z-50 rounded-full bg-black/75 px-3 py-1.5 text-xs font-medium text-white backdrop-blur hover:bg-black">
        Built with WebMindClub
      </a>
    </>
  )
}
