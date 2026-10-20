import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity as ActivityIcon, Bell, Check, ChevronsUpDown, FolderKanban, LayoutDashboard, LayoutTemplate, ListTodo, LogOut,
  Menu, Plus, Search, Settings, User as UserIcon, Users, Wand2, X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Logo } from '@/components/brand/logo'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator, DropdownTrigger } from '@/components/ui/dropdown'
import { Field, Input } from '@/components/ui/input'
import { ErrorState, LoadingState } from '@/components/ui/states'
import { qk, useCurrentWorkspace } from '@/hooks/use-workspace'
import { useDebounce } from '@/hooks/use-debounce'
import { errorMessage } from '@/lib/forms'
import { roleLabel } from '@/lib/labels'
import { cn, timeAgo } from '@/lib/utils'
import { activityApi, projectApi, workspaceApi } from '@/services/api'
import { useAuth } from '@/stores/auth'
import { useUi } from '@/stores/ui'
import { useWorkspaceStore } from '@/stores/workspace'

const NAV = [
  { to: '/app', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/app/projects', label: 'My Projects', icon: FolderKanban },
  { to: '/app/builder', label: 'Website Builder', icon: Wand2 },
  { to: '/app/templates', label: 'Templates', icon: LayoutTemplate },
  { to: '/app/team', label: 'Team', icon: Users },
  { to: '/app/tasks', label: 'Tasks', icon: ListTodo },
  { to: '/app/activity', label: 'Activity', icon: ActivityIcon },
  { to: '/app/settings', label: 'Settings', icon: Settings },
]

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5">
        <Logo to="/app" />
      </div>
      <nav className="flex-1 space-y-1 px-3 py-2" aria-label="Workspace">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                isActive ? 'bg-brand-blue/12 text-fg shadow-[inset_2px_0_0_#2563eb]' : 'text-muted hover:bg-hover hover:text-fg',
              )
            }
          >
            <Icon className="size-4" /> {label}
          </NavLink>
        ))}
      </nav>
      <div className="p-3">
        <Button asChild variant="gradient" className="w-full">
          <Link to="/app/projects/new" onClick={onNavigate}>
            <Plus /> Create Project
          </Link>
        </Button>
      </div>
    </div>
  )
}

function WorkspaceSwitcher() {
  const { workspace, workspaces } = useCurrentWorkspace()
  const setCurrent = useWorkspaceStore((s) => s.setCurrent)
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const create = async () => {
    if (name.trim().length < 2) return toast.error('Workspace name must have at least 2 characters.')
    setSaving(true)
    try {
      const ws = await workspaceApi.create(name.trim())
      await qc.invalidateQueries({ queryKey: qk.workspaces })
      setCurrent(ws.id)
      setOpen(false)
      setName('')
      toast.success(`Workspace “${ws.name}” created`)
      navigate('/app')
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }
  return (
    <>
      <Dropdown>
        <DropdownTrigger asChild>
          <Button variant="outline" className="max-w-56 justify-between gap-2">
            <span className="truncate">{workspace?.name ?? 'Workspace'}</span>
            <ChevronsUpDown className="text-muted" />
          </Button>
        </DropdownTrigger>
        <DropdownContent align="start" className="w-64">
          <DropdownLabel>Workspaces</DropdownLabel>
          {workspaces.map((w) => (
            <DropdownItem
              key={w.id}
              onSelect={() => {
                setCurrent(w.id)
                navigate('/app')
              }}
            >
              <span className="flex-1 truncate">{w.name}</span>
              <span className="text-xs text-muted">{roleLabel(w.role)}</span>
              {w.id === workspace?.id && <Check className="text-brand-blue" />}
            </DropdownItem>
          ))}
          <DropdownSeparator />
          <DropdownItem onSelect={() => setOpen(true)}>
            <Plus /> New workspace
          </DropdownItem>
        </DropdownContent>
      </Dropdown>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Create workspace" description="Workspaces group projects, members and settings.">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void create()
            }}
          >
            <Field label="Name" htmlFor="ws-name">
              <Input id="ws-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoFocus />
            </Field>
            <DialogFooter>
              <Button type="submit" loading={saving}>
                Create workspace
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

function GlobalSearch() {
  const { workspace } = useCurrentWorkspace()
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)
  const debounced = useDebounce(term)
  const navigate = useNavigate()
  const ref = useRef<HTMLDivElement>(null)
  const { data, isFetching } = useQuery({
    queryKey: qk.projects({ workspace: workspace?.id, search: debounced, quick: true }),
    queryFn: () => projectApi.list({ workspace: workspace!.id, search: debounced, page_size: 6 }),
    enabled: !!workspace && debounced.length > 1,
  })
  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])
  return (
    <div ref={ref} className="relative w-full max-w-md">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          setOpen(false)
          navigate(`/app/projects?search=${encodeURIComponent(term)}`)
        }}
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <Input
          value={term}
          onChange={(e) => {
            setTerm(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
          placeholder="Search projects…"
          aria-label="Search projects"
          className="pl-9"
        />
      </form>
      {open && debounced.length > 1 && (
        <div className="absolute left-0 right-0 top-12 z-50 rounded-xl border border-line bg-elevated p-1 shadow-xl">
          {isFetching && !data ? (
            <p className="px-3 py-2 text-sm text-muted">Searching…</p>
          ) : data?.results.length ? (
            data.results.map((p) => (
              <Link
                key={p.id}
                to={`/app/projects/${p.id}`}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-hover"
              >
                <span className="truncate">{p.name}</span>
                <span className="text-xs text-muted">{p.type_label}</span>
              </Link>
            ))
          ) : (
            <p className="px-3 py-2 text-sm text-muted">No projects match “{debounced}”.</p>
          )}
        </div>
      )}
    </div>
  )
}

function Notifications() {
  const { workspace } = useCurrentWorkspace()
  const storageKey = `wm-notifications-seen-${workspace?.id}`
  const [seen, setSeen] = useState(() => localStorage.getItem(storageKey) ?? '')
  useEffect(() => setSeen(localStorage.getItem(storageKey) ?? ''), [storageKey])
  const { data } = useQuery({
    queryKey: qk.activity({ workspace: workspace?.id, page: 1, bell: true }),
    queryFn: () => activityApi.list({ workspace: workspace!.id }),
    enabled: !!workspace,
    refetchInterval: 60_000,
  })
  const items = data?.results.slice(0, 8) ?? []
  const unread = items.filter((a) => a.created_at > seen).length
  return (
    <Dropdown
      onOpenChange={(open) => {
        if (!open && items[0]) {
          localStorage.setItem(storageKey, items[0].created_at)
          setSeen(items[0].created_at)
        }
      }}
    >
      <DropdownTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Notifications${unread ? ` (${unread} new)` : ''}`} className="relative">
          <Bell />
          {unread > 0 && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-brand-cyan" />}
        </Button>
      </DropdownTrigger>
      <DropdownContent className="w-80">
        <DropdownLabel>Recent activity</DropdownLabel>
        {items.length === 0 && <p className="px-3 py-4 text-sm text-muted">No notifications yet.</p>}
        {items.map((a) => (
          <DropdownItem key={a.id} asChild>
            <Link to={a.project ? `/app/projects/${a.project}/activity` : '/app/activity'} className="items-start">
              <Avatar name={a.actor?.display_name ?? 'System'} src={a.actor?.avatar} className="size-6" />
              <span className="flex-1">
                <span className="block text-sm">
                  <strong>{a.actor?.display_name ?? 'System'}</strong> {a.message}
                </span>
                <span className="text-xs text-muted">{timeAgo(a.created_at)}</span>
              </span>
              {a.created_at > seen && <span className="mt-1.5 size-2 rounded-full bg-brand-cyan" />}
            </Link>
          </DropdownItem>
        ))}
        <DropdownSeparator />
        <DropdownItem asChild>
          <Link to="/app/activity">View all activity</Link>
        </DropdownItem>
      </DropdownContent>
    </Dropdown>
  )
}

function UserMenu() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  if (!user) return null
  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <button className="rounded-full cursor-pointer" aria-label="Account menu">
          <Avatar name={user.display_name} src={user.avatar} />
        </button>
      </DropdownTrigger>
      <DropdownContent className="w-56">
        <div className="px-2.5 py-2">
          <p className="truncate text-sm font-medium">{user.display_name}</p>
          <p className="truncate text-xs text-muted">{user.email}</p>
        </div>
        <DropdownSeparator />
        <DropdownItem onSelect={() => navigate('/app/profile')}>
          <UserIcon /> Profile
        </DropdownItem>
        <DropdownItem onSelect={() => navigate('/app/settings')}>
          <Settings /> Settings
        </DropdownItem>
        <DropdownSeparator />
        <DropdownItem
          destructive
          onSelect={async () => {
            await logout()
            qc.clear()
            navigate('/signin')
          }}
        >
          <LogOut /> Sign out
        </DropdownItem>
      </DropdownContent>
    </Dropdown>
  )
}

export function WorkspaceLayout() {
  const { sidebarOpen, setSidebarOpen } = useUi()
  const location = useLocation()
  const { workspace, isLoading, error } = useCurrentWorkspace()
  useEffect(() => setSidebarOpen(false), [location.pathname, setSidebarOpen])
  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line bg-surface lg:block">
        <Sidebar />
      </aside>
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-line bg-surface animate-fade-in">
            <Button variant="ghost" size="icon" className="absolute right-3 top-3" aria-label="Close menu" onClick={() => setSidebarOpen(false)}>
              <X />
            </Button>
            <Sidebar onNavigate={() => setSidebarOpen(false)} />
          </aside>
        </div>
      )}
      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-bg/85 px-4 backdrop-blur-xl sm:px-6">
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu" onClick={() => setSidebarOpen(true)}>
          <Menu />
        </Button>
        <div className="hidden sm:block">
          <WorkspaceSwitcher />
        </div>
        <div className="flex flex-1 justify-center">
          <GlobalSearch />
        </div>
        <Notifications />
        <UserMenu />
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-4 sm:hidden">
          <WorkspaceSwitcher />
        </div>
        {isLoading ? <LoadingState /> : error ? <ErrorState error={error} /> : workspace ? <Outlet /> : <LoadingState />}
      </main>
    </div>
  )
}
