import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { FolderKanban, LayoutGrid, List, Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { AvatarStack } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states'
import { ProjectActions } from '@/features/projects/project-actions'
import { ProjectCard, ProjectIcon } from '@/features/projects/project-card'
import { qk, useCurrentWorkspace } from '@/hooks/use-workspace'
import { useDebounce } from '@/hooks/use-debounce'
import { PROJECT_STATUSES, PROJECT_TYPES, statusTone } from '@/lib/labels'
import { cn, timeAgo } from '@/lib/utils'
import { projectApi } from '@/services/api'

const SORTS = [
  { value: '-updated_at', label: 'Recently updated' },
  { value: '-created_at', label: 'Newest' },
  { value: 'name', label: 'Name A–Z' },
  { value: '-name', label: 'Name Z–A' },
  { value: 'status', label: 'Status' },
]

export default function ProjectsPage() {
  const { workspace } = useCurrentWorkspace()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState(params.get('search') ?? '')
  const [view, setView] = useState<'grid' | 'list'>(() => (localStorage.getItem('wm-project-view') as 'grid' | 'list') ?? 'grid')
  const status = params.get('status') ?? ''
  const type = params.get('type') ?? ''
  const ordering = params.get('ordering') ?? '-updated_at'
  const debounced = useDebounce(search)
  const query = { workspace: workspace!.id, search: debounced, status, project_type: type, ordering }
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: qk.projects(query),
    queryFn: () => projectApi.list(query),
    placeholderData: keepPreviousData,
  })
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }
  const setViewMode = (v: 'grid' | 'list') => {
    setView(v)
    localStorage.setItem('wm-project-view', v)
  }
  const filtered = !!(debounced || status || type)

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="My Projects"
        description="All projects you can access in this workspace."
        actions={
          <Button asChild variant="gradient">
            <Link to="/app/projects/new">
              <Plus /> Create Project
            </Link>
          </Button>
        }
      />
      <div className="mb-6 flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, slug or description" className="pl-9" aria-label="Search projects" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:flex">
          <Select aria-label="Filter by status" value={status} onChange={(e) => setParam('status', e.target.value)} className="sm:w-44">
            <option value="">All statuses</option>
            {PROJECT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
          <Select aria-label="Filter by type" value={type} onChange={(e) => setParam('type', e.target.value)} className="sm:w-40">
            <option value="">All types</option>
            {PROJECT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
          <Select aria-label="Sort" value={ordering} onChange={(e) => setParam('ordering', e.target.value)} className="sm:w-44">
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
          <div className="flex rounded-xl border border-line p-0.5">
            {(['grid', 'list'] as const).map((v) => (
              <button
                key={v}
                aria-label={`${v} view`}
                aria-pressed={view === v}
                onClick={() => setViewMode(v)}
                className={cn('flex flex-1 items-center justify-center rounded-lg px-2.5 cursor-pointer', view === v ? 'bg-elevated text-fg' : 'text-muted')}
              >
                {v === 'grid' ? <LayoutGrid className="size-4" /> : <List className="size-4" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      ) : !data?.results.length ? (
        <EmptyState
          icon={FolderKanban}
          title={filtered ? 'No projects match your filters' : 'No projects yet'}
          description={filtered ? 'Try another search term or clear the filters.' : 'Create your first project to start designing.'}
          action={
            filtered ? (
              <Button
                variant="outline"
                onClick={() => {
                  setSearch('')
                  setParams({}, { replace: true })
                }}
              >
                Clear filters
              </Button>
            ) : (
              <Button asChild variant="gradient">
                <Link to="/app/projects/new">
                  <Plus /> Create Project
                </Link>
              </Button>
            )
          }
        />
      ) : view === 'grid' ? (
        <div className={cn('grid gap-4 sm:grid-cols-2 xl:grid-cols-3 transition-opacity', isFetching && 'opacity-70')}>
          {data.results.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-card border border-line bg-surface">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Project</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Team</th>
                <th className="px-4 py-3 font-medium">Updated</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {data.results.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-0 hover:bg-hover/50">
                  <td className="px-4 py-3">
                    <Link to={`/app/projects/${p.id}`} className="flex items-center gap-3">
                      <ProjectIcon project={p} className="size-8" />
                      <span className="font-medium">{p.name}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{p.type_label}</td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone(p.status)}>{p.status_label}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <AvatarStack users={p.members} />
                  </td>
                  <td className="px-4 py-3 text-muted">{timeAgo(p.updated_at)}</td>
                  <td className="px-2">
                    <ProjectActions project={p} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && data.count > data.results.length && (
        <p className="mt-4 text-center text-xs text-muted">
          Showing {data.results.length} of {data.count} projects. Refine your search to narrow results.
        </p>
      )}
    </div>
  )
}
