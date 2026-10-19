import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, FolderKey, Info, MailPlus, ShieldCheck, Trash2, UserMinus } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Field, Input, Select } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { ErrorState, LoadingState } from '@/components/ui/states'
import { Switch } from '@/components/ui/switch'
import { isManager, qk, useCurrentWorkspace } from '@/hooks/use-workspace'
import { applyServerErrors, errorMessage } from '@/lib/forms'
import { WORKSPACE_ROLES, roleLabel } from '@/lib/labels'
import { formatDate } from '@/lib/utils'
import { projectApi, workspaceApi } from '@/services/api'
import { useAuth } from '@/stores/auth'
import type { Invitation, Membership } from '@/types'

const inviteSchema = z.object({
  email: z.email('Enter a valid email address.'),
  role: z.enum(['admin', 'developer', 'designer', 'project_manager', 'viewer']),
  projects: z.array(z.number()),
})
type InviteValues = z.infer<typeof inviteSchema>

function InviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { workspace } = useCurrentWorkspace()
  const qc = useQueryClient()
  const [result, setResult] = useState<Invitation | null>(null)
  const projects = useQuery({ queryKey: qk.projects({ workspace: workspace!.id, all: true }), queryFn: () => projectApi.list({ workspace: workspace!.id, page_size: 200 }), enabled: open })
  const form = useForm<InviteValues>({ resolver: zodResolver(inviteSchema), defaultValues: { email: '', role: 'developer', projects: [] } })
  const selected = form.watch('projects')
  const close = (o: boolean) => {
    onOpenChange(o)
    if (!o) {
      setResult(null)
      form.reset()
    }
  }
  const onSubmit = form.handleSubmit(async (v) => {
    try {
      const inv = await workspaceApi.invite({ ...v, workspace: workspace!.id })
      setResult(inv)
      void qc.invalidateQueries({ queryKey: qk.invitations(workspace!.id) })
    } catch (e) {
      applyServerErrors(e, form.setError, ['email', 'role', 'projects'])
    }
  })
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent title="Invite a team member" description="Choose a role and which projects they can access.">
        {result ? (
          <div className="space-y-4">
            {result.email_delivery_configured ? (
              <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">An invitation email was sent to {result.email}.</p>
            ) : (
              <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
                <Info className="size-5 shrink-0 text-amber-500" />
                <p>
                  Email delivery is not configured, so <strong>no email was sent</strong>. Share this invitation link with {result.email} directly.
                  It expires on {formatDate(result.expires_at)}.
                </p>
              </div>
            )}
            <div className="flex gap-2">
              <Input readOnly value={result.invite_url ?? ''} aria-label="Invitation link" onFocus={(e) => e.target.select()} />
              <Button variant="outline" size="icon" aria-label="Copy link" onClick={() => void navigator.clipboard?.writeText(result.invite_url ?? '').then(() => toast.success('Link copied'))}>
                <Copy />
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={() => close(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <Field label="Email" htmlFor="inv-email" error={form.formState.errors.email?.message}>
              <Input id="inv-email" type="email" autoFocus {...form.register('email')} />
            </Field>
            <Field label="Workspace role" htmlFor="inv-role" error={form.formState.errors.role?.message}>
              <Select id="inv-role" {...form.register('role')}>
                {WORKSPACE_ROLES.filter((r) => r.value !== 'owner').map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label} — {r.description}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="space-y-2">
              <p className="text-sm font-medium">Project access</p>
              <p className="text-xs text-muted">Admins see all projects. Other roles only see the projects selected here (plus projects shared with the whole workspace).</p>
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-line p-2 scrollbar-thin">
                {projects.data?.results.map((p) => (
                  <label key={p.id} className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-hover">
                    {p.name}
                    <input
                      type="checkbox"
                      className="size-4 accent-brand-blue"
                      checked={selected.includes(p.id)}
                      onChange={(e) => form.setValue('projects', e.target.checked ? [...selected, p.id] : selected.filter((x) => x !== p.id))}
                    />
                  </label>
                ))}
                {projects.data?.results.length === 0 && <p className="p-2 text-sm text-muted">No projects yet.</p>}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => close(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={form.formState.isSubmitting}>
                <MailPlus /> Create invitation
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

function AccessDialog({ member, onOpenChange }: { member: Membership | null; onOpenChange: (o: boolean) => void }) {
  const { workspace } = useCurrentWorkspace()
  const qc = useQueryClient()
  const projects = useQuery({ queryKey: qk.projects({ workspace: workspace!.id, all: true }), queryFn: () => projectApi.list({ workspace: workspace!.id, page_size: 200 }), enabled: !!member })
  const [busy, setBusy] = useState<number | null>(null)
  const toggle = async (projectId: number, on: boolean) => {
    if (!member) return
    setBusy(projectId)
    try {
      if (on) await projectApi.addMember(projectId, member.user.id, member.role === 'viewer' ? 'viewer' : 'editor')
      else {
        const pm = (await projectApi.members(projectId)).find((m) => m.user.id === member.user.id)
        if (pm) await projectApi.removeMember(projectId, pm.id)
      }
      await qc.invalidateQueries({ queryKey: qk.members(workspace!.id) })
      void qc.invalidateQueries({ queryKey: ['projects'] })
      toast.success(on ? 'Access granted' : 'Access removed')
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }
  const current = qc.getQueryData<Membership[]>(qk.members(workspace!.id))?.find((m) => m.id === member?.id) ?? member
  return (
    <Dialog open={!!member} onOpenChange={onOpenChange}>
      <DialogContent title={`Project access · ${member?.user.display_name ?? ''}`} description="Assign this member to specific projects without granting access to the whole workspace.">
        {projects.isLoading ? (
          <LoadingState />
        ) : (
          <ul className="max-h-80 space-y-1 overflow-y-auto scrollbar-thin">
            {projects.data?.results.map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-hover">
                <span className="text-sm">
                  {p.name} {p.visibility === 'workspace' && <span className="text-xs text-muted">(shared with workspace)</span>}
                </span>
                <Switch
                  aria-label={`Access to ${p.name}`}
                  disabled={busy === p.id || p.owner.id === member?.user.id}
                  checked={!!current?.project_ids.includes(p.id)}
                  onCheckedChange={(on) => void toggle(p.id, on)}
                />
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default function TeamPage() {
  const { workspace } = useCurrentWorkspace()
  const me = useAuth((s) => s.user)
  const qc = useQueryClient()
  const manager = isManager(workspace)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [access, setAccess] = useState<Membership | null>(null)
  const [removing, setRemoving] = useState<Membership | null>(null)
  const members = useQuery({ queryKey: qk.members(workspace!.id), queryFn: () => workspaceApi.members(workspace!.id) })
  const invitations = useQuery({ queryKey: qk.invitations(workspace!.id), queryFn: () => workspaceApi.invitations(workspace!.id), enabled: manager })
  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: number; role: string }) => workspaceApi.updateMember(id, role),
    onSuccess: () => (qc.invalidateQueries({ queryKey: qk.members(workspace!.id) }), toast.success('Role updated')),
    onError: (e) => toast.error(errorMessage(e)),
  })
  const remove = useMutation({
    mutationFn: (id: number) => workspaceApi.removeMember(id),
    onSuccess: () => (qc.invalidateQueries({ queryKey: qk.members(workspace!.id) }), qc.invalidateQueries({ queryKey: qk.workspaces }), toast.success('Member removed')),
    onError: (e) => toast.error(errorMessage(e)),
  })
  const revoke = useMutation({
    mutationFn: (id: number) => workspaceApi.revokeInvitation(id),
    onSuccess: () => (qc.invalidateQueries({ queryKey: qk.invitations(workspace!.id) }), toast.success('Invitation revoked')),
    onError: (e) => toast.error(errorMessage(e)),
  })

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Team"
        description={`Members of ${workspace!.name} and their roles.`}
        actions={
          manager && (
            <Button variant="gradient" onClick={() => setInviteOpen(true)}>
              <MailPlus /> Invite member
            </Button>
          )
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Members</CardTitle>
            <span className="text-sm text-muted">{members.data?.length ?? 0}</span>
          </CardHeader>
          {members.error ? (
            <ErrorState className="m-4" error={members.error} onRetry={() => members.refetch()} />
          ) : members.isLoading ? (
            <LoadingState />
          ) : (
            <ul className="divide-y divide-line">
              {members.data?.map((m) => (
                <li key={m.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar name={m.user.display_name} src={m.user.avatar} className="size-10" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {m.user.display_name} {m.user.id === me?.id && <span className="text-xs text-muted">(you)</span>}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {m.user.email} · {m.project_ids.length} assigned project{m.project_ids.length === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {manager && m.role !== 'owner' ? (
                      <Select aria-label={`Role of ${m.user.display_name}`} value={m.role} onChange={(e) => changeRole.mutate({ id: m.id, role: e.target.value })} className="h-9 w-44">
                        {WORKSPACE_ROLES.filter((r) => r.value !== 'owner').map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <Badge tone={m.role === 'owner' ? 'purple' : 'blue'}>{roleLabel(m.role)}</Badge>
                    )}
                    {manager && m.role !== 'owner' && m.role !== 'admin' && (
                      <Button variant="ghost" size="icon-sm" aria-label={`Project access for ${m.user.display_name}`} title="Project access" onClick={() => setAccess(m)}>
                        <FolderKey />
                      </Button>
                    )}
                    {m.role !== 'owner' && (manager || m.user.id === me?.id) && (
                      <Button variant="ghost" size="icon-sm" aria-label={m.user.id === me?.id ? 'Leave workspace' : `Remove ${m.user.display_name}`} className="hover:text-red-500" onClick={() => setRemoving(m)}>
                        <UserMinus />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          {manager && (
            <Card>
              <CardHeader>
                <CardTitle>Pending invitations</CardTitle>
              </CardHeader>
              <CardContent>
                {invitations.isLoading ? (
                  <LoadingState className="py-6" />
                ) : invitations.data?.length ? (
                  <ul className="space-y-3">
                    {invitations.data.map((inv) => (
                      <li key={inv.id} className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{inv.email}</p>
                          <p className="text-xs text-muted">
                            {roleLabel(inv.role)} · {inv.is_expired ? 'expired' : `expires ${formatDate(inv.expires_at)}`}
                          </p>
                        </div>
                        <Button variant="ghost" size="icon-sm" aria-label="Copy invitation link" onClick={() => void navigator.clipboard?.writeText(inv.invite_url ?? '').then(() => toast.success('Link copied'))}>
                          <Copy />
                        </Button>
                        <Button variant="ghost" size="icon-sm" aria-label="Revoke invitation" className="hover:text-red-500" onClick={() => revoke.mutate(inv.id)}>
                          <Trash2 />
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted">No pending invitations.</p>
                )}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-brand-blue" /> Roles
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                {WORKSPACE_ROLES.map((r) => (
                  <div key={r.value}>
                    <dt className="font-medium">{r.label}</dt>
                    <dd className="text-muted">{r.description}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-xs text-muted">SmartStock AI has its own store roles, managed inside the SmartStock app.</p>
            </CardContent>
          </Card>
        </div>
      </div>
      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />
      <AccessDialog member={access} onOpenChange={(o) => !o && setAccess(null)} />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={removing?.user.id === me?.id ? 'Leave workspace?' : `Remove ${removing?.user.display_name}?`}
        description="They will lose access to every project in this workspace."
        confirmLabel={removing?.user.id === me?.id ? 'Leave' : 'Remove member'}
        onConfirm={() => removing && remove.mutateAsync(removing.id).catch(() => undefined)}
      />
    </div>
  )
}
