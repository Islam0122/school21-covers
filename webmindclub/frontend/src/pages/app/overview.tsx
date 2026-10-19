import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, CheckCircle2, FolderKanban, Package, Plus, Rocket, Sparkles, Users, Zap } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states'
import { ActivityList } from '@/features/activity/activity-list'
import { ProjectIcon } from '@/features/projects/project-card'
import { isManager, qk, useCurrentWorkspace } from '@/hooks/use-workspace'
import { errorMessage } from '@/lib/forms'
import { TASK_PRIORITIES, statusTone } from '@/lib/labels'
import { formatDate, timeAgo } from '@/lib/utils'
import { workspaceApi } from '@/services/api'
import { useAuth } from '@/stores/auth'

export function LoadDemoButton({ workspaceId, variant = 'outline' }: { workspaceId: number; variant?: 'outline' | 'gradient' }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const demo = useMutation({
    mutationFn: () => workspaceApi.loadDemo(workspaceId),
    onSuccess: async (res) => {
      await qc.invalidateQueries()
      toast.success('SmartStock AI demo project created')
      navigate(`/app/projects/${res.project_id}`)
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  return (
    <Button variant={variant} loading={demo.isPending} onClick={() => demo.mutate()}>
      <Package /> Load SmartStock AI demo
    </Button>
  )
}

export default function OverviewPage() {
  const { workspace } = useCurrentWorkspace()
  const user = useAuth((s) => s.user)
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.stats(workspace!.id),
    queryFn: () => workspaceApi.stats(workspace!.id),
  })
  const hasSmartStock = data?.recent_projects.some((p) => p.has_store)

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={`Welcome back, ${user?.display_name.split(' ')[0] ?? ''}`}
        description={`Here’s what’s happening in ${workspace!.name}.`}
        actions={
          <Button asChild variant="gradient">
            <Link to="/app/projects/new">
              <Plus /> Create Project
            </Link>
          </Button>
        }
      />
      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {isLoading || !data ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[118px]" />)
            ) : (
              <>
                <StatCard label="Total Projects" value={data.total_projects} icon={FolderKanban} tone="blue" />
                <StatCard label="Active Projects" value={data.active_projects} icon={Zap} tone="cyan" hint="In progress or in review" />
                <StatCard label="Published Projects" value={data.published_projects} icon={Rocket} tone="green" />
                <StatCard label="Team Members" value={data.team_members} icon={Users} tone="purple" hint={`${data.open_tasks} open tasks · ${data.overdue_tasks} overdue`} />
              </>
            )}
          </div>

          {data && data.total_projects === 0 && (
            <EmptyState
              className="mt-6"
              icon={Sparkles}
              title="Start your first project"
              description="Create a project from a template, or load the SmartStock AI demo to explore every feature with sample data."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button asChild variant="gradient">
                    <Link to="/app/projects/new">
                      <Plus /> Create Project
                    </Link>
                  </Button>
                  {isManager(workspace) && <LoadDemoButton workspaceId={workspace!.id} />}
                </div>
              }
            />
          )}

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Recent Projects</CardTitle>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/app/projects">View all</Link>
                </Button>
              </CardHeader>
              <CardContent className="p-2">
                {isLoading ? (
                  <Skeleton className="m-3 h-40" />
                ) : data?.recent_projects.length ? (
                  <ul>
                    {data.recent_projects.map((p) => (
                      <li key={p.id}>
                        <Link to={`/app/projects/${p.id}`} className="flex items-center gap-3 rounded-xl p-3 hover:bg-hover">
                          <ProjectIcon project={p} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{p.name}</p>
                            <p className="text-xs text-muted">
                              {p.type_label} · updated {timeAgo(p.updated_at)}
                            </p>
                          </div>
                          <Badge tone={statusTone(p.status)}>{p.status_label}</Badge>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="p-6 text-center text-sm text-muted">No projects yet.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Upcoming Tasks</CardTitle>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/app/tasks">Board</Link>
                </Button>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-40" />
                ) : data?.upcoming_tasks.length ? (
                  <ul className="space-y-3">
                    {data.upcoming_tasks.map((t) => {
                      const prio = TASK_PRIORITIES.find((x) => x.value === t.priority)!
                      const overdue = t.due_date && new Date(t.due_date) < new Date(new Date().toDateString())
                      return (
                        <li key={t.id} className="flex items-start gap-3">
                          <CheckCircle2 className="mt-0.5 size-4 text-muted" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{t.title}</p>
                            <p className={`flex items-center gap-1 text-xs ${overdue ? 'text-red-500' : 'text-muted'}`}>
                              <CalendarClock className="size-3" /> {t.due_date ? formatDate(t.due_date) : 'No due date'} · {t.project_name}
                            </p>
                          </div>
                          <Badge tone={prio.tone}>{prio.label}</Badge>
                          {t.assignee && <Avatar name={t.assignee.display_name} src={t.assignee.avatar} className="size-6" />}
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className="py-6 text-center text-sm text-muted">No open tasks.</p>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/app/activity">View all</Link>
                </Button>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-40" />
                ) : data?.recent_activity.length ? (
                  <ActivityList items={data.recent_activity} />
                ) : (
                  <p className="py-6 text-center text-sm text-muted">No activity yet.</p>
                )}
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <div className="bg-brand-gradient p-5 text-white">
                <Package className="size-6" />
                <h3 className="mt-3 font-display text-lg font-semibold">SmartStock AI</h3>
                <p className="mt-1 text-sm text-white/80">AI-powered inventory intelligence for modern retail — the first WebMindClub product.</p>
              </div>
              <CardContent>
                {hasSmartStock ? (
                  <Button asChild className="w-full">
                    <Link to={`/app/projects/${data!.recent_projects.find((p) => p.has_store)!.id}`}>Open project</Link>
                  </Button>
                ) : isManager(workspace) ? (
                  <LoadDemoButton workspaceId={workspace!.id} />
                ) : (
                  <p className="text-sm text-muted">Ask a workspace admin to add the SmartStock AI demo project.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
