import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity as ActivityIcon, ArrowLeft, Eye, FileText, Globe, LayoutDashboard, ListTodo, Monitor, Package, Palette, Rocket,
  Settings, Smartphone, Tablet, Users, Wand2, ExternalLink, Info,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { AvatarStack } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, Input, Textarea } from '@/components/ui/input'
import { StatCard } from '@/components/ui/stat-card'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states'
import { ActivityList } from '@/features/activity/activity-list'
import { PublicationPanel } from '@/features/builder/publish-dialog'
import { EditProjectDialog } from '@/features/projects/edit-project-dialog'
import { ProjectActions } from '@/features/projects/project-actions'
import { ProjectIcon } from '@/features/projects/project-card'
import { ProjectTeam } from '@/features/projects/project-team'
import { TaskBoard } from '@/features/tasks/task-board'
import { qk } from '@/hooks/use-workspace'
import { errorMessage } from '@/lib/forms'
import { statusTone } from '@/lib/labels'
import { cn, formatDate } from '@/lib/utils'
import { builderApi, projectApi, smartstockApi } from '@/services/api'
import { ApiError } from '@/services/http'
import type { Project, WebsitePage } from '@/types'

const TABS = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'product', label: 'Product', icon: FileText },
  { key: 'tasks', label: 'Tasks', icon: ListTodo },
  { key: 'team', label: 'Team', icon: Users },
  { key: 'design', label: 'Design', icon: Palette },
  { key: 'preview', label: 'Preview', icon: Eye },
  { key: 'publish', label: 'Publish', icon: Rocket },
  { key: 'activity', label: 'Activity', icon: ActivityIcon },
  { key: 'settings', label: 'Settings', icon: Settings },
] as const

const SMARTSTOCK_FEATURES = [
  ['Dashboard', 'Inventory value, products, low stock, 30-day sales and potential savings.'],
  ['Inventory', 'Products with SKU, category, prices, stock, minimum stock and expiry dates. CRUD, search, filters, sorting and CSV export.'],
  ['AI Insights', 'Explainable stockout, overstock, expiry-risk and purchase-quantity recommendations computed from sales velocity.'],
  ['Purchase orders', 'Suppliers, order lines and expected delivery. Receiving an order updates stock in an audited transaction.'],
  ['Store roles', 'Store Manager, Inventory Clerk and Analyst — independent from WebMindClub workspace roles.'],
]

function OpenSmartStockButton({ project, size = 'default' }: { project: Project; size?: 'default' | 'sm' }) {
  const navigate = useNavigate()
  const stores = useQuery({ queryKey: ['stores', project.id], queryFn: () => smartstockApi.stores(project.id), enabled: project.has_store })
  if (!project.has_store) return null
  const store = stores.data?.[0]
  if (stores.isSuccess && !store)
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted" title="SmartStock has separate store roles">
        <Info className="size-3.5" /> No SmartStock role — ask the store manager for access.
      </span>
    )
  return (
    <Button variant="gradient" size={size} loading={stores.isLoading} onClick={() => store && navigate(`/smartstock/${store.id}`)}>
      <Package /> Open SmartStock AI
    </Button>
  )
}

function OverviewTab({ project }: { project: Project }) {
  const activity = useQuery({ queryKey: qk.projectActivity(project.id), queryFn: () => projectApi.activity(project.id) })
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pages" value={project.counts?.pages ?? 0} icon={FileText} />
        <StatCard label="Open tasks" value={project.counts?.open_tasks ?? 0} icon={ListTodo} tone="amber" hint={`${project.counts?.tasks ?? 0} total`} />
        <StatCard label="Team" value={project.counts?.members ?? 0} icon={Users} tone="purple" />
        <StatCard label="Publication" value={project.publication?.is_live ? `v${project.publication.version}` : 'Draft'} icon={Globe} tone="green" hint={project.publication?.is_live ? `Published ${formatDate(project.publication.published_at)}` : 'Not published yet'} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>About this project</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-line text-sm leading-relaxed text-muted">{project.description || 'No description yet.'}</p>
            <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted">Owner</dt>
                <dd className="mt-0.5 font-medium">{project.owner.display_name}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Created</dt>
                <dd className="mt-0.5 font-medium">{formatDate(project.created_at)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Visibility</dt>
                <dd className="mt-0.5 font-medium">{project.visibility === 'private' ? 'Private' : 'Workspace'}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <OpenSmartStockButton project={project} />
            <Button asChild variant={project.has_store ? 'outline' : 'gradient'}>
              <Link to={`/app/builder/${project.id}`}>
                <Wand2 /> {project.permissions.edit ? 'Open Website Builder' : 'View in builder'}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={`/preview/${project.id}`} target="_blank">
                <Eye /> Preview site
              </Link>
            </Button>
            {project.publication?.is_live && project.publication.slug && (
              <Button asChild variant="outline">
                <a href={`/sites/${project.publication.slug}`} target="_blank" rel="noreferrer">
                  <ExternalLink /> Open published site
                </a>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          {activity.isLoading ? <LoadingState className="py-6" /> : activity.data?.length ? <ActivityList items={activity.data.slice(0, 8)} showProject={false} /> : <p className="text-sm text-muted">No activity yet.</p>}
        </CardContent>
      </Card>
    </div>
  )
}

function ProductTab({ project }: { project: Project }) {
  const qc = useQueryClient()
  const [description, setDescription] = useState(project.description)
  const save = useMutation({
    mutationFn: () => projectApi.update(project.id, { description }),
    onSuccess: () => (qc.invalidateQueries({ queryKey: qk.project(project.id) }), toast.success('Description saved')),
    onError: (e) => toast.error(errorMessage(e)),
  })
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Product description</CardTitle>
        </CardHeader>
        <CardContent>
          <Field label="Description" htmlFor="prod-desc" hint={`${description.length}/2000`}>
            <Textarea id="prod-desc" rows={8} maxLength={2000} value={description} disabled={!project.permissions.edit} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          {project.permissions.edit && (
            <Button className="mt-4" disabled={description === project.description} loading={save.isPending} onClick={() => save.mutate()}>
              Save description
            </Button>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{project.has_store ? 'SmartStock AI features' : 'Project facts'}</CardTitle>
        </CardHeader>
        <CardContent>
          {project.has_store ? (
            <ul className="space-y-4">
              {SMARTSTOCK_FEATURES.map(([t, d]) => (
                <li key={t}>
                  <p className="text-sm font-medium">{t}</p>
                  <p className="text-xs text-muted">{d}</p>
                </li>
              ))}
            </ul>
          ) : (
            <dl className="space-y-3 text-sm">
              <div><dt className="text-xs text-muted">Type</dt><dd>{project.type_label}</dd></div>
              <div><dt className="text-xs text-muted">Template</dt><dd className="capitalize">{project.template.replace('_', ' ')}</dd></div>
              <div><dt className="text-xs text-muted">Status</dt><dd>{project.status_label}</dd></div>
            </dl>
          )}
          <div className="mt-5">
            <OpenSmartStockButton project={project} size="sm" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function DesignTab({ project }: { project: Project }) {
  const pages = useQuery({ queryKey: qk.pages(project.id), queryFn: () => builderApi.pages(project.id) })
  const theme = useQuery({ queryKey: qk.theme(project.id), queryFn: () => builderApi.theme(project.id) })
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Pages</CardTitle>
          <Button asChild size="sm">
            <Link to={`/app/builder/${project.id}`}>
              <Wand2 /> Open builder
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-2">
          {pages.isLoading ? (
            <LoadingState className="py-6" />
          ) : (
            <ul>
              {pages.data?.map((p: WebsitePage) => (
                <li key={p.id}>
                  <Link to={`/app/builder/${project.id}?page=${p.id}`} className="flex items-center gap-3 rounded-xl p-3 hover:bg-hover">
                    <FileText className="size-4 text-muted" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {p.title} {p.is_home && <Badge tone="blue">Home</Badge>}
                      </p>
                      <p className="truncate text-xs text-muted">
                        /{p.is_home ? '' : p.slug} · {p.content.blocks.length} components · SEO: {p.seo_title || '—'}
                      </p>
                    </div>
                    <Badge tone={p.status === 'published' ? 'green' : 'neutral'}>{p.status === 'published' ? 'Included' : 'Draft'}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
        </CardHeader>
        <CardContent>
          {theme.data ? (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-xl border border-line" style={{ background: theme.data.tokens.background, color: theme.data.tokens.text }}>
                <div className="p-4" style={{ fontFamily: theme.data.tokens.headingFont }}>
                  <p className="text-lg font-bold">Aa — {theme.data.tokens.headingFont}</p>
                  <p className="text-sm" style={{ color: theme.data.tokens.mutedText, fontFamily: theme.data.tokens.bodyFont }}>
                    Body text in {theme.data.tokens.bodyFont}
                  </p>
                  <span className="mt-3 inline-block px-3 py-1.5 text-sm font-semibold text-white" style={{ background: theme.data.tokens.primary, borderRadius: theme.data.tokens.buttonStyle === 'pill' ? 999 : theme.data.tokens.radius }}>
                    Button
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {(['primary', 'secondary', 'background', 'surface', 'text', 'mutedText'] as const).map((k) => (
                  <span key={k} title={`${k}: ${theme.data.tokens[k]}`} className="size-8 rounded-lg border border-line" style={{ background: theme.data.tokens[k] }} />
                ))}
              </div>
              <p className="text-xs text-muted">Preset: {theme.data.preset} · radius {theme.data.tokens.radius}px · container {theme.data.tokens.containerWidth}px</p>
            </div>
          ) : (
            <LoadingState className="py-6" />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function PreviewTab({ project }: { project: Project }) {
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
  const widths = { desktop: '100%', tablet: '768px', mobile: '390px' }
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-xl border border-line p-0.5" role="group" aria-label="Viewport">
          {([['desktop', Monitor], ['tablet', Tablet], ['mobile', Smartphone]] as const).map(([d, Icon]) => (
            <button key={d} onClick={() => setDevice(d)} aria-pressed={device === d} aria-label={`${d} preview`} className={cn('rounded-lg px-3 py-1.5 cursor-pointer', device === d ? 'bg-elevated text-fg' : 'text-muted')}>
              <Icon className="size-4" />
            </button>
          ))}
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to={`/preview/${project.id}`} target="_blank">
            <ExternalLink /> Open full preview
          </Link>
        </Button>
      </div>
      <div className="rounded-card border border-line bg-bg p-4">
        <iframe title="Site preview" src={`/preview/${project.id}`} className="mx-auto h-[75vh] w-full rounded-xl border border-line bg-white transition-[max-width]" style={{ maxWidth: widths[device] }} />
      </div>
      <p className="mt-2 text-xs text-muted">Preview renders the latest saved draft, including pages not yet published.</p>
    </div>
  )
}

function SettingsTab({ project }: { project: Project }) {
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const pages = useQuery({ queryKey: qk.pages(project.id), queryFn: () => builderApi.pages(project.id) })
  const qc = useQueryClient()
  const saveSeo = useMutation({
    mutationFn: ({ id, seo_title, seo_description }: { id: number; seo_title: string; seo_description: string }) => builderApi.updatePage(id, { seo_title, seo_description }),
    onSuccess: () => (qc.invalidateQueries({ queryKey: qk.pages(project.id) }), toast.success('SEO saved')),
    onError: (e) => toast.error(errorMessage(e)),
  })
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          {project.permissions.edit && (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div><dt className="text-xs text-muted">Name</dt><dd className="font-medium">{project.name}</dd></div>
            <div><dt className="text-xs text-muted">Slug</dt><dd className="font-medium">{project.slug}</dd></div>
            <div><dt className="text-xs text-muted">Visibility</dt><dd className="font-medium">{project.visibility === 'private' ? 'Private — assigned members only' : 'Workspace — all members can view'}</dd></div>
            <div><dt className="text-xs text-muted">Published URL</dt><dd className="truncate font-medium">{project.publication?.is_live ? `/sites/${project.publication.slug}` : 'Not published'}</dd></div>
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>SEO</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {pages.data?.map((p) => (
            <form
              key={p.id}
              className="grid gap-3 rounded-xl border border-line p-4 md:grid-cols-[1fr_2fr_auto] md:items-end"
              onSubmit={(e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                saveSeo.mutate({ id: p.id, seo_title: String(fd.get('seo_title')), seo_description: String(fd.get('seo_description')) })
              }}
            >
              <Field label={`${p.title} · SEO title`} htmlFor={`seo-t-${p.id}`}>
                <Input id={`seo-t-${p.id}`} name="seo_title" defaultValue={p.seo_title} maxLength={70} disabled={!project.permissions.edit} />
              </Field>
              <Field label="SEO description" htmlFor={`seo-d-${p.id}`}>
                <Input id={`seo-d-${p.id}`} name="seo_description" defaultValue={p.seo_description} maxLength={180} disabled={!project.permissions.edit} />
              </Field>
              {project.permissions.edit && (
                <Button type="submit" variant="outline">
                  Save
                </Button>
              )}
            </form>
          ))}
        </CardContent>
      </Card>
      {project.permissions.manage && (
        <Card className="border-red-500/30">
          <CardHeader>
            <CardTitle className="text-red-500">Danger zone</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">Archive, duplicate or permanently delete this project.</p>
            <ProjectActions project={project} onDeleted={() => navigate('/app/projects')} />
          </CardContent>
        </Card>
      )}
      <EditProjectDialog project={project} open={editing} onOpenChange={setEditing} />
    </div>
  )
}

export default function ProjectWorkspacePage() {
  const { projectId = '', tab = 'overview' } = useParams()
  const id = Number(projectId)
  const navigate = useNavigate()
  const { data: project, isLoading, error, refetch } = useQuery({ queryKey: qk.project(id), queryFn: () => projectApi.get(id) })
  const activity = useQuery({ queryKey: qk.projectActivity(id), queryFn: () => projectApi.activity(id), enabled: tab === 'activity' })

  if (isLoading) return <LoadingState />
  if (error instanceof ApiError && error.status === 404)
    return <EmptyState title="Project not found" description="It may have been deleted, or you don’t have access to it." action={<Button asChild><Link to="/app/projects">Back to projects</Link></Button>} />
  if (error || !project) return <ErrorState error={error} onRetry={() => refetch()} />

  return (
    <div className="animate-fade-in">
      <Link to="/app/projects" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Projects
      </Link>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <ProjectIcon project={project} className="size-14" />
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">{project.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge tone={statusTone(project.status)}>{project.status_label}</Badge>
              <Badge>{project.type_label}</Badge>
              {!project.permissions.edit && <Badge tone="amber">Read-only</Badge>}
              <AvatarStack users={project.members} />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <OpenSmartStockButton project={project} />
          <Button asChild variant="outline">
            <Link to={`/app/builder/${project.id}`}>
              <Wand2 /> Builder
            </Link>
          </Button>
          <ProjectActions project={project} onDeleted={() => navigate('/app/projects')} />
        </div>
      </div>

      <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-line scrollbar-thin" aria-label="Project sections">
        {TABS.map(({ key, label, icon: Icon }) => (
          <Link
            key={key}
            to={`/app/projects/${project.id}${key === 'overview' ? '' : `/${key}`}`}
            aria-current={tab === key ? 'page' : undefined}
            className={cn('flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors', tab === key ? 'border-brand-blue text-fg' : 'border-transparent text-muted hover:text-fg')}
          >
            <Icon className="size-4" /> {label}
          </Link>
        ))}
      </nav>

      {tab === 'overview' && <OverviewTab project={project} />}
      {tab === 'product' && <ProductTab key={project.updated_at} project={project} />}
      {tab === 'tasks' && <TaskBoard projectId={project.id} canEdit={project.permissions.edit} />}
      {tab === 'team' && <ProjectTeam project={project} />}
      {tab === 'design' && <DesignTab project={project} />}
      {tab === 'preview' && <PreviewTab project={project} />}
      {tab === 'publish' && (
        <Card className="max-w-2xl">
          <CardContent>
            <PublicationPanel projectId={project.id} canEdit={project.permissions.edit} />
          </CardContent>
        </Card>
      )}
      {tab === 'activity' && (
        <Card>
          <CardContent>{activity.isLoading ? <LoadingState /> : activity.data?.length ? <ActivityList items={activity.data} showProject={false} /> : <p className="text-sm text-muted">No activity yet.</p>}</CardContent>
        </Card>
      )}
      {tab === 'settings' && <SettingsTab project={project} />}
    </div>
  )
}
