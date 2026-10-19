import { useQuery } from '@tanstack/react-query'
import { Plus, Wand2 } from 'lucide-react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states'
import { ProjectIcon } from '@/features/projects/project-card'
import { qk, useCurrentWorkspace } from '@/hooks/use-workspace'
import { statusTone } from '@/lib/labels'
import { timeAgo } from '@/lib/utils'
import { projectApi } from '@/services/api'

export default function BuilderIndexPage() {
  const { workspace } = useCurrentWorkspace()
  const q = { workspace: workspace!.id, ordering: '-updated_at' }
  const { data, isLoading, error, refetch } = useQuery({ queryKey: qk.projects(q), queryFn: () => projectApi.list(q) })
  return (
    <div className="animate-fade-in">
      <PageHeader title="Website Builder" description="Choose a project to design its pages visually." />
      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <Skeleton className="h-64" />
      ) : !data?.results.length ? (
        <EmptyState
          icon={Wand2}
          title="No projects to design yet"
          description="Create a project first — it comes with starter pages you can edit here."
          action={
            <Button asChild variant="gradient">
              <Link to="/app/projects/new">
                <Plus /> Create Project
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.results.map((p) => (
            <div key={p.id} className="flex items-center gap-4 rounded-card border border-line bg-surface p-4">
              <ProjectIcon project={p} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{p.name}</p>
                <p className="flex items-center gap-2 text-xs text-muted">
                  <Badge tone={statusTone(p.status)}>{p.status_label}</Badge> {timeAgo(p.updated_at)}
                </p>
              </div>
              <Button asChild size="sm" variant={p.permissions.edit ? 'default' : 'outline'}>
                <Link to={`/app/builder/${p.id}`}>
                  <Wand2 /> {p.permissions.edit ? 'Design' : 'View'}
                </Link>
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
