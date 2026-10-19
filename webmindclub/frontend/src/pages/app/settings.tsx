import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Monitor, Moon, Sun, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PasswordForm } from '@/features/team/password-form'
import { ProfileForm } from '@/features/team/profile-form'
import { isManager, qk, useCurrentWorkspace } from '@/hooks/use-workspace'
import { errorMessage } from '@/lib/forms'
import { WORKSPACE_ROLES, roleLabel } from '@/lib/labels'
import { cn } from '@/lib/utils'
import { authApi, workspaceApi } from '@/services/api'
import { useAuth } from '@/stores/auth'
import { useUi } from '@/stores/ui'

const PERMISSIONS: [string, string[]][] = [
  ['Manage members & invitations', ['owner', 'admin']],
  ['Edit workspace settings', ['owner', 'admin']],
  ['See all projects', ['owner', 'admin']],
  ['Create projects', ['owner', 'admin', 'developer', 'designer', 'project_manager']],
  ['Edit assigned projects', ['owner', 'admin', 'developer', 'designer', 'project_manager']],
  ['View assigned projects', ['owner', 'admin', 'developer', 'designer', 'project_manager', 'viewer']],
  ['Delete workspace', ['owner']],
]

function WorkspaceSettings() {
  const { workspace } = useCurrentWorkspace()
  const qc = useQueryClient()
  const manager = isManager(workspace)
  const [name, setName] = useState(workspace!.name)
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => setName(workspace!.name), [workspace])
  const update = useMutation({
    mutationFn: (data: Parameters<typeof workspaceApi.update>[1]) => workspaceApi.update(workspace!.id, data),
    onSuccess: () => (qc.invalidateQueries({ queryKey: qk.workspaces }), toast.success('Workspace updated')),
    onError: (e) => toast.error(errorMessage(e)),
  })
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
        </CardHeader>
        <CardContent>
          <fieldset disabled={!manager} className="space-y-5">
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                if (name.trim().length < 2) return toast.error('Name must have at least 2 characters.')
                update.mutate({ name: name.trim() })
              }}
            >
              <Field label="Workspace name" htmlFor="ws-name">
                <Input id="ws-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Button type="submit" loading={update.isPending} disabled={name === workspace!.name}>
                Save name
              </Button>
            </form>
            <div className="space-y-2">
              <p className="text-sm font-medium">Logo</p>
              <div className="flex items-center gap-3">
                {workspace!.logo ? <img src={workspace!.logo} alt="" className="size-12 rounded-xl object-cover" /> : <span className="size-12 rounded-xl bg-brand-gradient" />}
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <Upload /> Upload logo
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    const fd = new FormData()
                    fd.append('logo', f)
                    update.mutate(fd)
                  }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Default theme</p>
              <div className="flex gap-2">
                {(['dark', 'light'] as const).map((t) => (
                  <Button key={t} type="button" variant={workspace!.theme === t ? 'default' : 'outline'} size="sm" onClick={() => update.mutate({ theme: t })} className="capitalize">
                    {t === 'dark' ? <Moon /> : <Sun />} {t}
                  </Button>
                ))}
              </div>
            </div>
          </fieldset>
          {!manager && <p className="mt-4 text-xs text-muted">Only owners and admins can change workspace settings. Your role: {roleLabel(workspace!.role)}.</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Members & permissions</CardTitle>
          <Button asChild size="sm" variant="outline">
            <Link to="/app/team">Manage members</Link>
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-xs">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-2 pr-2 font-medium">Permission</th>
                {WORKSPACE_ROLES.map((r) => (
                  <th key={r.value} className="px-1 py-2 text-center font-medium">
                    {r.label.replace('Workspace ', '')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map(([perm, roles]) => (
                <tr key={perm} className="border-t border-line">
                  <td className="py-2 pr-2">{perm}</td>
                  {WORKSPACE_ROLES.map((r) => (
                    <td key={r.value} className="text-center">
                      {roles.includes(r.value) ? '✓' : <span className="text-muted">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted">Permissions are enforced by the API; the UI only reflects them.</p>
        </CardContent>
      </Card>
    </div>
  )
}

function AppearanceSettings() {
  const { appearance, setAppearance } = useUi()
  const setUser = useAuth((s) => s.setUser)
  const options = [
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'system', label: 'System', icon: Monitor },
  ] as const
  return (
    <div className="grid max-w-lg grid-cols-3 gap-3">
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          aria-pressed={appearance === value}
          onClick={() => {
            setAppearance(value)
            void authApi.updateMe({ appearance: value }).then(setUser).catch(() => undefined)
          }}
          className={cn('flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium cursor-pointer', appearance === value ? 'border-brand-blue bg-brand-blue/10' : 'border-line hover:bg-hover')}
        >
          <Icon className="size-5" /> {label}
        </button>
      ))}
    </div>
  )
}

export default function SettingsPage() {
  const { tab = 'workspace' } = useParams()
  const navigate = useNavigate()
  return (
    <div className="animate-fade-in">
      <PageHeader title="Settings" description="Workspace, account and appearance preferences. Project settings live inside each project." />
      <Tabs value={tab} onValueChange={(v) => navigate(`/app/settings/${v}`, { replace: true })}>
        <TabsList className="mb-6">
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="security">Password</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
        </TabsList>
        <TabsContent value="workspace">
          <WorkspaceSettings />
        </TabsContent>
        <TabsContent value="account">
          <Card>
            <CardContent>
              <ProfileForm />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="security">
          <Card>
            <CardContent>
              <PasswordForm />
              <p className="mt-4 text-xs text-muted">
                Forgot your password? Sign out and use “Forgot password” on the sign-in page.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="appearance">
          <Card>
            <CardContent>
              <AppearanceSettings />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
